#!/usr/bin/env python3
"""
Verificador estático ligero para el Luau de este proyecto (sin dependencias).

  * Analiza la sintaxis (sentencias, expresiones, tipos básicos de Luau, +=, continue...).
  * Detecta variables globales no declaradas (lecturas y escrituras), que en Roblox
    suelen ser errores de ámbito o de escritura.

Uso:  python3 tools/luau_check.py [carpeta]   (por defecto: src)
Sale con código 1 si encuentra problemas.
No sustituye a Roblox Studio: no comprueba tipos, APIs ni comportamiento en ejecución.
"""
import os
import re
import sys

KEYWORDS = {
    "and", "break", "do", "else", "elseif", "end", "false", "for", "function", "if", "in",
    "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while",
}
GLOBALS = {
    "game", "workspace", "script", "plugin", "shared", "Instance", "Vector3", "Vector2", "CFrame", "Color3",
    "UDim", "UDim2", "Enum", "task", "math", "string", "table", "os", "pairs", "ipairs", "next",
    "tostring", "tonumber", "type", "typeof", "pcall", "xpcall", "error", "assert", "warn", "print",
    "require", "setmetatable", "getmetatable", "select", "unpack", "utf8", "Random", "NumberSequence",
    "ColorSequence", "NumberRange", "TweenInfo", "Ray", "RaycastParams", "ColorSequenceKeypoint",
    "NumberSequenceKeypoint", "rawget", "rawset", "rawequal", "rawlen", "coroutine", "tick", "time", "buffer",
    "bit32", "debug", "Rect", "BrickColor", "PhysicalProperties", "Font", "DateTime", "OverlapParams",
    "PathWaypoint", "Axes", "Faces", "Region3", "gcinfo", "newproxy", "elapsedTime", "delay", "spawn", "wait",
}

TOKEN_RE = re.compile(r"""
    (?P<ws>[ \t\r\n]+)
  | (?P<comment>--\[(?P<ceq>=*)\[.*?\](?P=ceq)\]|--[^\n]*)
  | (?P<lstring>\[(?P<seq>=*)\[.*?\](?P=seq)\])
  | (?P<string>"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')
  | (?P<istring>`(?:\\.|[^`\\])*`)
  | (?P<number>0[xX][0-9a-fA-F_]+|0[bB][01_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?)
  | (?P<name>[A-Za-z_][A-Za-z0-9_]*)
  | (?P<op>\.\.\.|\.\.=|//=|\.\.|==|~=|<=|>=|::|->|\+=|-=|\*=|/=|%=|\^=|//|[-+*/%^#<>=(){}\[\];:,.?|&])
""", re.S | re.X)


class LuauError(Exception):
    pass


def tokenize(src):
    tokens = []
    pos, line = 0, 1
    while pos < len(src):
        m = TOKEN_RE.match(src, pos)
        if not m:
            raise LuauError("línea %d: carácter inesperado %r" % (line, src[pos]))
        kind = m.lastgroup
        text = m.group(0)
        if kind in ("ws", "comment"):
            pass
        elif kind == "name" and text in KEYWORDS:
            tokens.append(("kw", text, line))
        elif kind in ("lstring", "string", "istring"):
            tokens.append(("string", text, line))
        elif kind in ("ceq", "seq"):
            pass
        else:
            tokens.append((kind, text, line))
        line += text.count("\n")
        pos = m.end()
    tokens.append(("eof", "<eof>", line))
    return tokens


class Parser:
    def __init__(self, tokens, filename):
        self.t = tokens
        self.i = 0
        self.file = filename
        self.scopes = [set()]
        self.problems = []

    # ---- utilidades ----
    def peek(self, k=0):
        return self.t[self.i + k]

    def check(self, text, kind=None):
        tok = self.peek()
        return tok[1] == text and (kind is None or tok[0] == kind) and tok[0] in ("kw", "op", kind or "kw")

    def is_op(self, text):
        tok = self.peek()
        return tok[0] == "op" and tok[1] == text

    def is_kw(self, text):
        tok = self.peek()
        return tok[0] == "kw" and tok[1] == text

    def advance(self):
        tok = self.t[self.i]
        self.i += 1
        return tok

    def expect_op(self, text):
        if not self.is_op(text):
            self.fail("se esperaba '%s'" % text)
        return self.advance()

    def expect_kw(self, text):
        if not self.is_kw(text):
            self.fail("se esperaba '%s'" % text)
        return self.advance()

    def expect_name(self):
        tok = self.peek()
        if tok[0] != "name":
            self.fail("se esperaba un nombre")
        return self.advance()

    def fail(self, msg):
        tok = self.peek()
        raise LuauError("línea %d: %s (encontrado %r)" % (tok[2], msg, tok[1]))

    # ---- ámbitos ----
    def push(self):
        self.scopes.append(set())

    def pop(self):
        self.scopes.pop()

    def declare(self, name):
        self.scopes[-1].add(name)

    def use(self, name, line):
        for scope in reversed(self.scopes):
            if name in scope:
                return
        if name not in GLOBALS:
            self.problems.append("línea %d: variable global no declarada '%s'" % (line, name))

    # ---- tipos (se analizan solo para saltarlos) ----
    def skip_type(self):
        self.type_union()

    def type_union(self):
        self.type_simple()
        while self.is_op("|") or self.is_op("&"):
            self.advance()
            self.type_simple()

    def type_simple(self):
        tok = self.peek()
        if self.is_op("?"):
            self.advance()
            return
        if tok[0] == "kw" and tok[1] in ("nil", "true", "false"):
            self.advance()
        elif tok[0] == "string":
            self.advance()
        elif tok[0] == "name":
            self.advance()
            if tok[1] == "typeof" and self.is_op("("):
                self.skip_balanced("(", ")")
            while self.is_op("."):
                self.advance()
                self.expect_name()
            if self.is_op("<"):
                self.skip_balanced("<", ">")
        elif self.is_op("{"):
            self.skip_balanced("{", "}")
        elif self.is_op("("):
            self.skip_balanced("(", ")")
            if self.is_op("->"):
                self.advance()
                self.type_union()
        elif self.is_op("..."):
            self.advance()
            self.type_simple()
        else:
            self.fail("tipo no válido")
        while self.is_op("?"):
            self.advance()

    def skip_balanced(self, open_, close):
        depth = 0
        while True:
            tok = self.advance()
            if tok[0] == "eof":
                self.fail("falta '%s'" % close)
            if tok[0] == "op" and tok[1] == open_:
                depth += 1
            elif tok[0] == "op" and tok[1] == close:
                depth -= 1
                if depth == 0:
                    return

    # ---- bloques ----
    def chunk(self):
        self.block()
        if self.peek()[0] != "eof":
            self.fail("se esperaba el final del archivo")

    def block_end(self):
        tok = self.peek()
        return tok[0] == "eof" or (tok[0] == "kw" and tok[1] in ("end", "else", "elseif", "until"))

    def block(self):
        while not self.block_end():
            if self.is_kw("return"):
                self.advance()
                if not self.block_end() and not self.is_op(";"):
                    self.explist()
                if self.is_op(";"):
                    self.advance()
                return
            self.statement()

    def statement(self):
        tok = self.peek()
        if self.is_op(";"):
            self.advance()
        elif tok[0] == "kw":
            k = tok[1]
            if k == "if":
                self.advance()
                self.expr()
                self.expect_kw("then")
                self.scoped_block()
                while self.is_kw("elseif"):
                    self.advance()
                    self.expr()
                    self.expect_kw("then")
                    self.scoped_block()
                if self.is_kw("else"):
                    self.advance()
                    self.scoped_block()
                self.expect_kw("end")
            elif k == "while":
                self.advance()
                self.expr()
                self.expect_kw("do")
                self.scoped_block()
                self.expect_kw("end")
            elif k == "do":
                self.advance()
                self.scoped_block()
                self.expect_kw("end")
            elif k == "for":
                self.advance()
                names = [self.expect_name()[1]]
                if self.is_op(":"):
                    self.advance()
                    self.skip_type()
                if self.is_op("="):
                    self.advance()
                    self.expr()
                    self.expect_op(",")
                    self.expr()
                    if self.is_op(","):
                        self.advance()
                        self.expr()
                else:
                    while self.is_op(","):
                        self.advance()
                        names.append(self.expect_name()[1])
                        if self.is_op(":"):
                            self.advance()
                            self.skip_type()
                    self.expect_kw("in")
                    self.explist()
                self.expect_kw("do")
                self.push()
                for n in names:
                    self.declare(n)
                self.block()
                self.pop()
                self.expect_kw("end")
            elif k == "repeat":
                self.advance()
                self.push()
                self.block()
                self.expect_kw("until")
                self.expr()
                self.pop()
            elif k == "function":
                self.advance()
                name_tok = self.expect_name()
                self.use(name_tok[1], name_tok[2])
                is_method = False
                while self.is_op(".") or self.is_op(":"):
                    is_method = self.advance()[1] == ":"
                    self.expect_name()
                    if is_method:
                        break
                self.funcbody(is_method)
            elif k == "local":
                self.advance()
                if self.is_kw("function"):
                    self.advance()
                    name = self.expect_name()[1]
                    self.declare(name)
                    self.funcbody(False)
                else:
                    names = []
                    while True:
                        names.append(self.expect_name()[1])
                        if self.is_op("<"):  # atributos <const>/<close>
                            self.skip_balanced("<", ">")
                        if self.is_op(":"):
                            self.advance()
                            self.skip_type()
                        if not self.is_op(","):
                            break
                        self.advance()
                    if self.is_op("="):
                        self.advance()
                        self.explist()
                    for n in names:
                        self.declare(n)
            elif k == "break":
                self.advance()
            elif k == "return":
                self.fail("'return' debe ser la última sentencia del bloque")
            else:
                self.fail("sentencia inesperada")
        elif tok[0] == "name" and tok[1] == "continue" and self.statement_end_after(1):
            self.advance()
        elif tok[0] == "name" and tok[1] in ("type", "export") and self.type_decl_ahead():
            if tok[1] == "export":
                self.advance()
            self.advance()  # type
            self.expect_name()
            if self.is_op("<"):
                self.skip_balanced("<", ">")
            self.expect_op("=")
            self.skip_type()
        else:
            self.expr_statement()

    def statement_end_after(self, k):
        nxt = self.peek(k)
        return nxt[0] == "eof" or (nxt[0] == "kw" and nxt[1] in ("end", "else", "elseif", "until")) or nxt[1] == ";"

    def type_decl_ahead(self):
        k = 1
        if self.peek()[1] == "export":
            if self.peek(1)[1] != "type":
                return False
            k = 2
        return self.peek(k)[0] == "name" and self.peek(k + 1)[1] in ("=", "<")

    def scoped_block(self):
        self.push()
        self.block()
        self.pop()

    def expr_statement(self):
        kind = self.suffixedexp()
        if self.is_op("=") or self.is_op(","):
            if kind == "call":
                self.fail("no se puede asignar a una llamada")
            while self.is_op(","):
                self.advance()
                self.suffixedexp()
            self.expect_op("=")
            self.explist()
        elif self.peek()[0] == "op" and self.peek()[1] in ("+=", "-=", "*=", "/=", "%=", "^=", "..=", "//="):
            self.advance()
            self.expr()
        elif kind != "call":
            self.fail("se esperaba una llamada o una asignación")

    def funcbody(self, is_method):
        self.expect_op("(")
        self.push()
        if is_method:
            self.declare("self")
        if not self.is_op(")"):
            while True:
                if self.is_op("..."):
                    self.advance()
                    if self.is_op(":"):
                        self.advance()
                        self.skip_type()
                    break
                self.declare(self.expect_name()[1])
                if self.is_op(":"):
                    self.advance()
                    self.skip_type()
                if not self.is_op(","):
                    break
                self.advance()
        self.expect_op(")")
        if self.is_op(":"):
            self.advance()
            self.skip_type()
        self.block()
        self.pop()
        self.expect_kw("end")

    # ---- expresiones ----
    def explist(self):
        self.expr()
        while self.is_op(","):
            self.advance()
            self.expr()

    BINARY = {
        "or": 1, "and": 2, "<": 3, ">": 3, "<=": 3, ">=": 3, "~=": 3, "==": 3,
        "..": 4, "+": 5, "-": 5, "*": 6, "/": 6, "//": 6, "%": 6, "^": 8,
    }

    def binop(self):
        tok = self.peek()
        if tok[0] in ("op", "kw") and tok[1] in self.BINARY:
            return tok[1]
        return None

    def expr(self, limit=0):
        tok = self.peek()
        if (tok[0] == "kw" and tok[1] == "not") or (tok[0] == "op" and tok[1] in ("-", "#")):
            self.advance()
            self.expr(7)
        else:
            self.simpleexp()
        while True:
            op = self.binop()
            if op is None or self.BINARY[op] <= limit:
                break
            self.advance()
            right = self.BINARY[op] - 1 if op in ("..", "^") else self.BINARY[op]
            self.expr(right)

    def simpleexp(self):
        tok = self.peek()
        if tok[0] in ("number", "string"):
            self.advance()
        elif tok[0] == "kw" and tok[1] in ("nil", "true", "false"):
            self.advance()
        elif self.is_op("..."):
            self.advance()
        elif self.is_op("{"):
            self.table()
        elif tok[0] == "kw" and tok[1] == "function":
            self.advance()
            self.funcbody(False)
        elif tok[0] == "kw" and tok[1] == "if":
            self.advance()
            self.expr()
            self.expect_kw("then")
            self.expr()
            while self.is_kw("elseif"):
                self.advance()
                self.expr()
                self.expect_kw("then")
                self.expr()
            self.expect_kw("else")
            self.expr()
        else:
            self.suffixedexp()
        if self.is_op("::"):
            self.advance()
            self.skip_type()

    def primaryexp(self):
        tok = self.peek()
        if tok[0] == "name":
            self.advance()
            self.use(tok[1], tok[2])
        elif self.is_op("("):
            self.advance()
            self.expr()
            self.expect_op(")")
        else:
            self.fail("expresión no válida")

    def suffixedexp(self):
        self.primaryexp()
        kind = "var"
        while True:
            tok = self.peek()
            if self.is_op("."):
                self.advance()
                self.expect_name()
                kind = "var"
            elif self.is_op("["):
                self.advance()
                self.expr()
                self.expect_op("]")
                kind = "var"
            elif self.is_op(":"):
                self.advance()
                self.expect_name()
                self.args()
                kind = "call"
            elif self.is_op("(") or self.is_op("{") or tok[0] == "string":
                self.args()
                kind = "call"
            else:
                return kind

    def args(self):
        tok = self.peek()
        if tok[0] == "string":
            self.advance()
        elif self.is_op("{"):
            self.table()
        else:
            self.expect_op("(")
            if not self.is_op(")"):
                self.explist()
            self.expect_op(")")

    def table(self):
        self.expect_op("{")
        while not self.is_op("}"):
            if self.is_op("["):
                self.advance()
                self.expr()
                self.expect_op("]")
                self.expect_op("=")
                self.expr()
            elif self.peek()[0] == "name" and self.peek(1)[1] == "=" and self.peek(1)[0] == "op":
                self.advance()
                self.advance()
                self.expr()
            else:
                self.expr()
            if self.is_op(",") or self.is_op(";"):
                self.advance()
            elif not self.is_op("}"):
                self.fail("se esperaba ',' o '}' en la tabla")
        self.advance()


def check_file(path):
    with open(path, encoding="utf-8") as f:
        src = f.read()
    try:
        parser = Parser(tokenize(src), path)
        parser.chunk()
        return parser.problems
    except LuauError as e:
        return ["ERROR DE SINTAXIS " + str(e)]


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "src"
    total, files = 0, 0
    for dirpath, _, filenames in os.walk(root):
        for name in sorted(filenames):
            if name.endswith(".lua") or name.endswith(".luau"):
                files += 1
                path = os.path.join(dirpath, name)
                for problem in check_file(path):
                    total += 1
                    print("%s: %s" % (path, problem))
    print("%d archivos revisados, %d problemas" % (files, total))
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
