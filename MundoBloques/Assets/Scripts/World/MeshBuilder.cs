using System;
using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    /// <summary>Copia de 3x3 chunks con luz calculada. Se reutiliza por hilo.</summary>
    public sealed class Snap
    {
        public const int PW = 48, OFF = 16, HGT = 128;
        public const int PLANE = PW * PW;
        public const int VOL = PW * PW * HGT;
        public readonly ushort[] blocks = new ushort[VOL];
        public readonly byte[] meta = new byte[VOL];
        public readonly byte[] sky = new byte[VOL];
        public readonly byte[] blk = new byte[VOL];
        public readonly byte[] biome = new byte[PLANE];
        public readonly int[] queue = new int[VOL * 2];

        [ThreadStatic] static Snap tl;
        public static Snap Take() { if (tl == null) tl = new Snap(); return tl; }

        public static int PI(int px, int y, int pz) { return (y * PW + pz) * PW + px; }

        public void Fill(World w, Chunk c)
        {
            for (int dz = -1; dz <= 1; dz++)
                for (int dx = -1; dx <= 1; dx++)
                {
                    Chunk n = w.GetChunkNoCache(c.cx + dx, c.cz + dz);
                    int ox = (dx + 1) * 16, oz = (dz + 1) * 16;
                    bool ok = n != null && n.state == 2;
                    for (int y = 0; y < HGT; y++)
                        for (int z = 0; z < 16; z++)
                        {
                            int dst = PI(ox, y, oz + z);
                            if (ok)
                            {
                                int src = Chunk.Idx(0, y, z);
                                Buffer.BlockCopy(n.blocks, src * 2, blocks, dst * 2, 32);
                                Buffer.BlockCopy(n.meta, src, meta, dst, 16);
                            }
                            else
                            {
                                Array.Clear(blocks, dst, 16);
                                Array.Clear(meta, dst, 16);
                            }
                        }
                    for (int z = 0; z < 16; z++)
                        for (int x = 0; x < 16; x++)
                            biome[(oz + z) * PW + ox + x] = ok ? n.biome[z * 16 + x] : (byte)BiomeId.Plains;
                }
        }
    }

    /// <summary>Tablas de propiedades por id de bloque para hilos de fondo.</summary>
    public static class BTab
    {
        public static byte[] Atten;         // 255 = opaco; si no, atenuacion extra
        public static byte[] Emit;
        public static bool[] Opaque;
        public static byte[] Sub;           // submalla: 0 opaco, 1 recorte, 2 transparente
        static readonly object lk = new object();

        public static void Ensure()
        {
            if (Atten != null) return;
            lock (lk)
            {
                if (Atten != null) return;
                int n = Block.All.Count;
                var a = new byte[n]; var e = new byte[n]; var o = new bool[n]; var s = new byte[n];
                for (int i = 0; i < n; i++)
                {
                    var b = Block.All[i];
                    o[i] = b.opaque && b.shape == Shape.Cube;
                    a[i] = (byte)(b.opaque ? 255 : (b == B.Water ? 2 : (B.IsLeaves(b) ? 1 : (b == B.Ice ? 1 : 0))));
                    e[i] = (byte)b.light;
                    s[i] = (byte)(b.translucent || b == B.Water ? 2 : ((b.cutout || b.shape == Shape.Cross || b.shape == Shape.Crop) ? 1 : 0));
                }
                Emit = e; Opaque = o; Sub = s; Atten = a;
            }
        }
    }

    public static class MeshBuilder
    {
        public static void Build(World w, Chunk c, MeshData md)
        {
            BTab.Ensure();
            var s = Snap.Take();
            s.Fill(w, c);
            LightEngine.Compute(s, w.hasSky);
            // luz del chunk para consultas de juego
            for (int y = 0; y < 128; y++)
                for (int z = 0; z < 16; z++)
                    for (int x = 0; x < 16; x++)
                    {
                        int pi = Snap.PI(x + Snap.OFF, y, z + Snap.OFF);
                        c.light[Chunk.Idx(x, y, z)] = (byte)((s.sky[pi] << 4) | s.blk[pi]);
                    }
            md.Clear();
            new Mesher(s, c, md, w.hasSky).Run();
        }
    }

    public static class LightEngine
    {
        public static void Compute(Snap s, bool hasSky)
        {
            const int PW = Snap.PW;
            var atten = BTab.Atten; var emit = BTab.Emit;
            Array.Clear(s.sky, 0, s.sky.Length);
            Array.Clear(s.blk, 0, s.blk.Length);
            var q = s.queue;
            int tail = 0;
            if (hasSky)
            {
                for (int pz = 0; pz < PW; pz++)
                    for (int px = 0; px < PW; px++)
                    {
                        int level = 15;
                        for (int y = 127; y >= 0; y--)
                        {
                            int i = Snap.PI(px, y, pz);
                            int a = atten[s.blocks[i]];
                            if (a == 255) break;
                            level -= a;
                            if (level <= 0) break;
                            s.sky[i] = (byte)level;
                        }
                    }
                // semillas: celdas iluminadas con un vecino horizontal mas oscuro
                for (int y = 0; y < 128; y++)
                    for (int pz = 1; pz < PW - 1; pz++)
                        for (int px = 1; px < PW - 1; px++)
                        {
                            int i = Snap.PI(px, y, pz);
                            int l = s.sky[i];
                            if (l <= 1) continue;
                            if (s.sky[i - 1] < l - 1 && atten[s.blocks[i - 1]] != 255 || s.sky[i + 1] < l - 1 && atten[s.blocks[i + 1]] != 255
                                || s.sky[i - PW] < l - 1 && atten[s.blocks[i - PW]] != 255 || s.sky[i + PW] < l - 1 && atten[s.blocks[i + PW]] != 255)
                                if (tail < q.Length) q[tail++] = i;
                        }
                Propagate(s, s.sky, tail);
            }
            tail = 0;
            for (int i = 0; i < Snap.VOL; i++)
            {
                int e = emit[s.blocks[i]];
                if (e > 0) { s.blk[i] = (byte)e; if (tail < q.Length) q[tail++] = i; }
            }
            if (tail > 0) Propagate(s, s.blk, tail);
        }

        static void Propagate(Snap s, byte[] lv, int tail)
        {
            const int PW = Snap.PW, PLANE = Snap.PLANE;
            var q = s.queue; var atten = BTab.Atten; var blocks = s.blocks;
            int head = 0;
            while (head < tail)
            {
                int i = q[head++];
                int l = lv[i];
                if (l <= 1) continue;
                int y = i / PLANE; int rem = i - y * PLANE; int pz = rem / PW; int px = rem - pz * PW;
                if (px > 0) Try(i - 1, l, lv, blocks, atten, q, ref tail);
                if (px < PW - 1) Try(i + 1, l, lv, blocks, atten, q, ref tail);
                if (pz > 0) Try(i - PW, l, lv, blocks, atten, q, ref tail);
                if (pz < PW - 1) Try(i + PW, l, lv, blocks, atten, q, ref tail);
                if (y > 0) Try(i - PLANE, l, lv, blocks, atten, q, ref tail);
                if (y < 127) Try(i + PLANE, l, lv, blocks, atten, q, ref tail);
            }
        }

        static void Try(int ni, int l, byte[] lv, ushort[] blocks, byte[] atten, int[] q, ref int tail)
        {
            int a = atten[blocks[ni]];
            if (a == 255) return;
            int nl = l - 1 - a;
            if (nl > lv[ni] && tail < q.Length) { lv[ni] = (byte)nl; q[tail++] = ni; }
        }
    }

    /// <summary>Genera la malla de un chunk a partir de la copia con luz.</summary>
    public sealed class Mesher
    {
        const int PW = Snap.PW, OFF = Snap.OFF;
        readonly Snap s; readonly Chunk c; readonly MeshData md; readonly bool hasSky;
        readonly Box[] boxes = new Box[12];
        readonly float[] vx = new float[4], vy = new float[4], vz = new float[4], fu = new float[4], fv = new float[4];
        readonly float[] lsky = new float[4], lblk = new float[4], aov = new float[4];
        readonly int[] aoi = new int[4];
        readonly float[] tintG = new float[256 * 3], tintF = new float[256 * 3], tintW = new float[256 * 3];
        static readonly float[] aoTable = { 0.5f, 0.66f, 0.83f, 1f };

        // vectores derecha/arriba de cada cara y normal
        static readonly int[][] Right = {
            new[] { 0, 0, -1 }, new[] { 0, 0, 1 }, new[] { 1, 0, 0 }, new[] { 1, 0, 0 }, new[] { 1, 0, 0 }, new[] { -1, 0, 0 } };
        static readonly int[][] Up = {
            new[] { 0, 1, 0 }, new[] { 0, 1, 0 }, new[] { 0, 0, -1 }, new[] { 0, 0, 1 }, new[] { 0, 1, 0 }, new[] { 0, 1, 0 } };
        static readonly float[] Shade = { 0.8f, 0.8f, 1f, 0.5f, 0.65f, 0.65f };
        static readonly int[] SR = { -1, -1, 1, 1 };
        static readonly int[] SU = { -1, 1, 1, -1 };

        public Mesher(Snap s, Chunk c, MeshData md, bool hasSky) { this.s = s; this.c = c; this.md = md; this.hasSky = hasSky; }

        void BuildTints()
        {
            for (int lz = 0; lz < 16; lz++)
                for (int lx = 0; lx < 16; lx++)
                {
                    float gr = 0, gg = 0, gb = 0, fr = 0, fg = 0, fb = 0, wr = 0, wg = 0, wb = 0; int n = 0;
                    for (int dz = -2; dz <= 2; dz++)
                        for (int dx = -2; dx <= 2; dx++)
                        {
                            int bi = s.biome[(OFF + lz + dz) * PW + OFF + lx + dx];
                            var info = Biomes.Info[bi];
                            gr += (info.grass >> 16) & 255; gg += (info.grass >> 8) & 255; gb += info.grass & 255;
                            fr += (info.foliage >> 16) & 255; fg += (info.foliage >> 8) & 255; fb += info.foliage & 255;
                            wr += (info.water >> 16) & 255; wg += (info.water >> 8) & 255; wb += info.water & 255;
                            n++;
                        }
                    int k = (lz * 16 + lx) * 3;
                    float inv = 1f / (255f * n);
                    tintG[k] = gr * inv; tintG[k + 1] = gg * inv; tintG[k + 2] = gb * inv;
                    tintF[k] = fr * inv; tintF[k + 1] = fg * inv; tintF[k + 2] = fb * inv;
                    tintW[k] = wr * inv; tintW[k + 1] = wg * inv; tintW[k + 2] = wb * inv;
                }
        }

        public void Run()
        {
            BuildTints();
            int maxY = 0;
            for (int i = 0; i < 256; i++) if (c.top[i] > maxY) maxY = c.top[i];
            var blocks = s.blocks; var all = Block.All;
            for (int y = 0; y <= maxY; y++)
                for (int z = 0; z < 16; z++)
                    for (int x = 0; x < 16; x++)
                    {
                        int pi = Snap.PI(x + OFF, y, z + OFF);
                        ushort id = blocks[pi];
                        if (id == 0) continue;
                        var b = all[id];
                        switch (b.shape)
                        {
                            case Shape.Fluid: EmitFluid(b, x, y, z, pi); break;
                            case Shape.Cross: EmitCross(b, x, y, z, pi, b.tex[0]); break;
                            case Shape.Crop: EmitCrop(b, x, y, z, pi); break;
                            default: EmitBoxes(b, x, y, z, pi); break;
                        }
                    }
        }

        // ---------------- utilidades ----------------
        bool Opq(int idx) { return BTab.Opaque[s.blocks[idx]]; }

        /// <summary>Devuelve true si es opaco; rellena luz de la celda (px,py,pz) en el pad.</summary>
        bool Sample(int px, int py, int pz, out int sky, out int blk)
        {
            if (py < 0) { sky = 0; blk = 0; return true; }
            if (py > 127) { sky = hasSky ? 15 : 0; blk = 0; return false; }
            int i = Snap.PI(px, py, pz);
            sky = s.sky[i]; blk = s.blk[i];
            return BTab.Opaque[s.blocks[i]];
        }

        static byte B8(float v) { return (byte)(v <= 0 ? 0 : (v >= 1 ? 255 : (int)(v * 255f + 0.5f))); }

        void TintFor(Block b, int face, int x, int z, out float r, out float g, out float bl)
        {
            r = g = bl = 1f;
            if (b.tint == Tint.None || (b.tintMask & (1 << face)) == 0) return;
            int k = (z * 16 + x) * 3;
            float[] t = b.tint == Tint.Grass ? tintG : (b.tint == Tint.Foliage ? tintF : tintW);
            r = t[k]; g = t[k + 1]; bl = t[k + 2];
        }

        // ---------------- cajas (cubos, losas, escaleras, puertas...) ----------------
        void EmitBoxes(Block b, int x, int y, int z, int pi)
        {
            int meta = s.meta[pi];
            int n = Shapes.Boxes(b, meta, boxes);
            if (n == 0) return;
            int sub = BTab.Sub[b.id];
            bool ao = b.shape != Shape.Torch && b.shape != Shape.Portal && b.shape != Shape.Door && b.shape != Shape.Fence && b.shape != Shape.Pane && b.shape != Shape.Gate && b.shape != Shape.Ladder;
            for (int bi = 0; bi < n; bi++)
            {
                var bx = boxes[bi];
                for (int f = 0; f < 6; f++)
                {
                    // ¿la cara esta en el borde de la celda?
                    bool edge;
                    switch (f)
                    {
                        case 0: edge = bx.x1 >= 1f; break;
                        case 1: edge = bx.x0 <= 0f; break;
                        case 2: edge = bx.y1 >= 1f; break;
                        case 3: edge = bx.y0 <= 0f; break;
                        case 4: edge = bx.z1 >= 1f; break;
                        default: edge = bx.z0 <= 0f; break;
                    }
                    if (edge)
                    {
                        int ny = y + Block.DY[f];
                        if (ny < 0) continue;
                        if (ny <= 127)
                        {
                            ushort nid = s.blocks[Snap.PI(x + OFF + Block.DX[f], ny, z + OFF + Block.DZ[f])];
                            if (nid != 0)
                            {
                                var nb = Block.All[nid];
                                if (nb.FullOpaque) continue;
                                if (nb == b && (b.translucent || B.IsLeaves(b) || b == B.Glass)) continue;
                            }
                        }
                    }
                    int tile;
                    if (bx.tile >= 0) tile = bx.tile;
                    else if (b.shape == Shape.Door) tile = (meta & 8) != 0 ? b.tex[1] : b.tex[0];
                    else if (b.oriented && f == Block.FaceOfFacing[meta & 3]) tile = b.tex[6];
                    else tile = b.tex[f];
                    // desplazar la cara de las puertas abiertas/cerradas ligeramente no hace falta
                    float tr, tg, tb;
                    TintFor(b, f, x, z, out tr, out tg, out tb);
                    Box ub = bx;
                    if (b.shape == Shape.Torch)
                    {
                        float tox, toy, toz; Shapes.TorchOffset(meta, out tox, out toy, out toz);
                        ub = new Box(bx.x0 - tox, bx.y0 - toy, bx.z0 - toz, bx.x1 - tox, bx.y1 - toy, bx.z1 - toz);
                    }
                    EmitFace(f, x, y, z, bx, ub, tile, sub, tr, tg, tb, 255, pi, ao);
                }
            }
        }

        void EmitFace(int f, int x, int y, int z, Box bx, Box ub, int tile, int sub, float tr, float tg, float tb, int alpha, int ownIdx, bool ao)
        {
            float x0 = bx.x0, x1 = bx.x1, y0 = bx.y0, y1 = bx.y1, z0 = bx.z0, z1 = bx.z1;
            float ux0 = ub.x0, ux1 = ub.x1, uy0 = ub.y0, uy1 = ub.y1, uz0 = ub.z0, uz1 = ub.z1;   // coordenadas para la textura
            // vertices BL, TL, TR, BR y uv locales
            switch (f)
            {
                case 0: // +X
                    vx[0] = vx[1] = vx[2] = vx[3] = x1;
                    vy[0] = y0; vy[1] = y1; vy[2] = y1; vy[3] = y0;
                    vz[0] = z1; vz[1] = z1; vz[2] = z0; vz[3] = z0;
                    fu[0] = 1 - uz1; fu[1] = 1 - uz1; fu[2] = 1 - uz0; fu[3] = 1 - uz0; fv[0] = uy0; fv[1] = uy1; fv[2] = uy1; fv[3] = uy0; break;
                case 1: // -X
                    vx[0] = vx[1] = vx[2] = vx[3] = x0;
                    vy[0] = y0; vy[1] = y1; vy[2] = y1; vy[3] = y0;
                    vz[0] = z0; vz[1] = z0; vz[2] = z1; vz[3] = z1;
                    fu[0] = uz0; fu[1] = uz0; fu[2] = uz1; fu[3] = uz1; fv[0] = uy0; fv[1] = uy1; fv[2] = uy1; fv[3] = uy0; break;
                case 2: // +Y
                    vy[0] = vy[1] = vy[2] = vy[3] = y1;
                    vx[0] = x0; vx[1] = x0; vx[2] = x1; vx[3] = x1;
                    vz[0] = z1; vz[1] = z0; vz[2] = z0; vz[3] = z1;
                    fu[0] = ux0; fu[1] = ux0; fu[2] = ux1; fu[3] = ux1; fv[0] = uz1; fv[1] = uz0; fv[2] = uz0; fv[3] = uz1; break;
                case 3: // -Y
                    vy[0] = vy[1] = vy[2] = vy[3] = y0;
                    vx[0] = x0; vx[1] = x0; vx[2] = x1; vx[3] = x1;
                    vz[0] = z0; vz[1] = z1; vz[2] = z1; vz[3] = z0;
                    fu[0] = ux0; fu[1] = ux0; fu[2] = ux1; fu[3] = ux1; fv[0] = uz0; fv[1] = uz1; fv[2] = uz1; fv[3] = uz0; break;
                case 4: // +Z
                    vz[0] = vz[1] = vz[2] = vz[3] = z1;
                    vx[0] = x0; vx[1] = x0; vx[2] = x1; vx[3] = x1;
                    vy[0] = y0; vy[1] = y1; vy[2] = y1; vy[3] = y0;
                    fu[0] = ux0; fu[1] = ux0; fu[2] = ux1; fu[3] = ux1; fv[0] = uy0; fv[1] = uy1; fv[2] = uy1; fv[3] = uy0; break;
                default: // -Z
                    vz[0] = vz[1] = vz[2] = vz[3] = z0;
                    vx[0] = x1; vx[1] = x1; vx[2] = x0; vx[3] = x0;
                    vy[0] = y0; vy[1] = y1; vy[2] = y1; vy[3] = y0;
                    fu[0] = 1 - ux1; fu[1] = 1 - ux1; fu[2] = 1 - ux0; fu[3] = 1 - ux0; fv[0] = uy0; fv[1] = uy1; fv[2] = uy1; fv[3] = uy0; break;
            }
            // Unity usa coordenadas zurdas: con estos vertices las caras laterales y la inferior saldrian espejadas, se invierte la U
            if (f != 2) for (int k = 0; k < 4; k++) fu[k] = 1f - fu[k];
            float tu0 = TileAtlas.U0[tile], tu1 = TileAtlas.U1[tile], tv0 = TileAtlas.V0[tile], tv1 = TileAtlas.V1[tile];

            // luz y AO por vertice
            int bpx = x + OFF + Block.DX[f], bpy = y + Block.DY[f], bpz = z + OFF + Block.DZ[f];
            int baseSky, baseBlk;
            bool baseOpq = Sample(bpx, bpy, bpz, out baseSky, out baseBlk);
            if (baseOpq) { baseSky = s.sky[ownIdx]; baseBlk = s.blk[ownIdx]; }
            var rr = Right[f]; var uu = Up[f];
            for (int k = 0; k < 4; k++)
            {
                int sr = SR[k], su = SU[k];
                int sk1, bl1, sk2, bl2, skc, blc;
                bool o1 = Sample(bpx + sr * rr[0], bpy + sr * rr[1], bpz + sr * rr[2], out sk1, out bl1);
                bool o2 = Sample(bpx + su * uu[0], bpy + su * uu[1], bpz + su * uu[2], out sk2, out bl2);
                bool oc = Sample(bpx + sr * rr[0] + su * uu[0], bpy + sr * rr[1] + su * uu[1], bpz + sr * rr[2] + su * uu[2], out skc, out blc);
                int cnt = 1, ss = baseSky, sb = baseBlk;
                if (!o1) { cnt++; ss += sk1; sb += bl1; }
                if (!o2) { cnt++; ss += sk2; sb += bl2; }
                if (!(o1 && o2) && !oc) { cnt++; ss += skc; sb += blc; }
                lsky[k] = ss / (15f * cnt); lblk[k] = sb / (15f * cnt);
                int a = (o1 && o2) ? 0 : 3 - (o1 ? 1 : 0) - (o2 ? 1 : 0) - (oc ? 1 : 0);
                aoi[k] = ao ? a : 3;
                aov[k] = aoTable[aoi[k]];
            }

            int baseIdx = md.verts.Count;
            float shade = Shade[f];
            for (int k = 0; k < 4; k++)
            {
                md.verts.Add(new Vector3(x + vx[k], y + vy[k], z + vz[k]));
                md.uvs.Add(new Vector2(tu0 + (tu1 - tu0) * fu[k], tv0 + (tv1 - tv0) * fv[k]));
                md.uv2.Add(new Vector2(lsky[k], lblk[k]));
                float m = shade * aov[k];
                md.colors.Add(new Color32(B8(tr * m), B8(tg * m), B8(tb * m), (byte)alpha));
            }
            var t = md.tris[sub];
            // orden horario visto desde fuera (cara frontal en Unity)
            if (aoi[0] + aoi[2] >= aoi[1] + aoi[3])
            { t.Add(baseIdx); t.Add(baseIdx + 2); t.Add(baseIdx + 1); t.Add(baseIdx); t.Add(baseIdx + 3); t.Add(baseIdx + 2); }
            else
            { t.Add(baseIdx + 1); t.Add(baseIdx + 3); t.Add(baseIdx + 2); t.Add(baseIdx + 1); t.Add(baseIdx); t.Add(baseIdx + 3); }
        }

        // ---------------- plantas ----------------
        void Quad2(int sub, Vector3 a, Vector3 b2, Vector3 c2, Vector3 d, int tile, Color32 col, float sky, float blk)
        {
            // a=BL b=TL c=TR d=BR, doble cara
            float tu0 = TileAtlas.U0[tile], tu1 = TileAtlas.U1[tile], tv0 = TileAtlas.V0[tile], tv1 = TileAtlas.V1[tile];
            int bi = md.verts.Count;
            md.verts.Add(a); md.verts.Add(b2); md.verts.Add(c2); md.verts.Add(d);
            md.uvs.Add(new Vector2(tu0, tv0)); md.uvs.Add(new Vector2(tu0, tv1)); md.uvs.Add(new Vector2(tu1, tv1)); md.uvs.Add(new Vector2(tu1, tv0));
            for (int k = 0; k < 4; k++) { md.uv2.Add(new Vector2(sky, blk)); md.colors.Add(col); }
            var t = md.tris[sub];
            t.Add(bi); t.Add(bi + 1); t.Add(bi + 2); t.Add(bi); t.Add(bi + 2); t.Add(bi + 3);
            t.Add(bi + 2); t.Add(bi + 1); t.Add(bi); t.Add(bi + 3); t.Add(bi + 2); t.Add(bi);
        }

        void EmitCross(Block b, int x, int y, int z, int pi, int tile)
        {
            float tr, tg, tb; TintFor(b, 2, x, z, out tr, out tg, out tb);
            var col = new Color32(B8(tr * 0.95f), B8(tg * 0.95f), B8(tb * 0.95f), 255);
            float sky = s.sky[pi] / 15f, blk = s.blk[pi] / 15f;
            if (b.light > 0) blk = Math.Max(blk, b.light / 15f);
            const float lo = 0.12f, hi = 0.88f;
            Quad2(1, new Vector3(x + lo, y, z + lo), new Vector3(x + lo, y + 1, z + lo), new Vector3(x + hi, y + 1, z + hi), new Vector3(x + hi, y, z + hi), tile, col, sky, blk);
            Quad2(1, new Vector3(x + hi, y, z + lo), new Vector3(x + hi, y + 1, z + lo), new Vector3(x + lo, y + 1, z + hi), new Vector3(x + lo, y, z + hi), tile, col, sky, blk);
        }

        void EmitCrop(Block b, int x, int y, int z, int pi)
        {
            int age = s.meta[pi];
            int tile = b.tex[Math.Min(3, age / 2)];
            var col = new Color32(255, 255, 255, 255);
            float sky = s.sky[pi] / 15f, blk = s.blk[pi] / 15f;
            float yo = -0.0625f;
            Quad2(1, new Vector3(x + 0.25f, y + yo, z), new Vector3(x + 0.25f, y + 1 + yo, z), new Vector3(x + 0.25f, y + 1 + yo, z + 1), new Vector3(x + 0.25f, y + yo, z + 1), tile, col, sky, blk);
            Quad2(1, new Vector3(x + 0.75f, y + yo, z), new Vector3(x + 0.75f, y + 1 + yo, z), new Vector3(x + 0.75f, y + 1 + yo, z + 1), new Vector3(x + 0.75f, y + yo, z + 1), tile, col, sky, blk);
            Quad2(1, new Vector3(x, y + yo, z + 0.25f), new Vector3(x, y + 1 + yo, z + 0.25f), new Vector3(x + 1, y + 1 + yo, z + 0.25f), new Vector3(x + 1, y + yo, z + 0.25f), tile, col, sky, blk);
            Quad2(1, new Vector3(x, y + yo, z + 0.75f), new Vector3(x, y + 1 + yo, z + 0.75f), new Vector3(x + 1, y + 1 + yo, z + 0.75f), new Vector3(x + 1, y + yo, z + 0.75f), tile, col, sky, blk);
        }

        // ---------------- fluidos ----------------
        void EmitFluid(Block b, int x, int y, int z, int pi)
        {
            int meta = s.meta[pi];
            bool water = b == B.Water;
            int sub = water ? 2 : 0;
            int alpha = water ? 185 : 255;
            // altura de la superficie
            float h;
            ushort aboveId = y < 127 ? s.blocks[pi + Snap.PLANE] : (ushort)0;
            if (aboveId == b.id || (meta & 8) != 0) h = 1f;
            else if (meta == 0) h = 0.88f;
            else h = Math.Max(0.12f, (8 - (meta & 7)) / 9f);
            float tr, tg, tb; TintFor(b, 2, x, z, out tr, out tg, out tb);
            int tile = b.tex[0];
            float sky = s.sky[pi] / 15f, blk = s.blk[pi] / 15f;
            if (b.light > 0) blk = 1f;
            float tu0 = TileAtlas.U0[tile], tu1 = TileAtlas.U1[tile], tv0 = TileAtlas.V0[tile], tv1 = TileAtlas.V1[tile];
            for (int f = 0; f < 6; f++)
            {
                int nx = x + OFF + Block.DX[f], ny = y + Block.DY[f], nz = z + OFF + Block.DZ[f];
                if (ny < 0) continue;
                ushort nid = ny > 127 ? (ushort)0 : s.blocks[Snap.PI(nx, ny, nz)];
                var nb = Block.All[nid];
                if (nid == b.id) continue;
                if (nb.FullOpaque && f != 2) continue;
                if (f == 2 && nb.FullOpaque) continue;
                if (nb.fluid && nb != b && f != 2 && f != 3) { }
                float shade = Shade[f];
                int lsx = nx, lsy = Math.Min(127, Math.Max(0, ny)), lsz = nz;
                int ls = s.sky[Snap.PI(lsx, lsy, lsz)], lb = s.blk[Snap.PI(lsx, lsy, lsz)];
                float sk = Math.Max(sky, ls / 15f), bk = Math.Max(blk, lb / 15f);
                var col = new Color32(B8(tr * shade), B8(tg * shade), B8(tb * shade), (byte)alpha);
                float y1 = h;
                int bi = md.verts.Count;
                switch (f)
                {
                    case 0: md.verts.Add(new Vector3(x + 1, y, z + 1)); md.verts.Add(new Vector3(x + 1, y + y1, z + 1)); md.verts.Add(new Vector3(x + 1, y + y1, z)); md.verts.Add(new Vector3(x + 1, y, z)); break;
                    case 1: md.verts.Add(new Vector3(x, y, z)); md.verts.Add(new Vector3(x, y + y1, z)); md.verts.Add(new Vector3(x, y + y1, z + 1)); md.verts.Add(new Vector3(x, y, z + 1)); break;
                    case 2: md.verts.Add(new Vector3(x, y + y1, z + 1)); md.verts.Add(new Vector3(x, y + y1, z)); md.verts.Add(new Vector3(x + 1, y + y1, z)); md.verts.Add(new Vector3(x + 1, y + y1, z + 1)); break;
                    case 3: md.verts.Add(new Vector3(x, y, z)); md.verts.Add(new Vector3(x, y, z + 1)); md.verts.Add(new Vector3(x + 1, y, z + 1)); md.verts.Add(new Vector3(x + 1, y, z)); break;
                    case 4: md.verts.Add(new Vector3(x, y, z + 1)); md.verts.Add(new Vector3(x, y + y1, z + 1)); md.verts.Add(new Vector3(x + 1, y + y1, z + 1)); md.verts.Add(new Vector3(x + 1, y, z + 1)); break;
                    default: md.verts.Add(new Vector3(x + 1, y, z)); md.verts.Add(new Vector3(x + 1, y + y1, z)); md.verts.Add(new Vector3(x, y + y1, z)); md.verts.Add(new Vector3(x, y, z)); break;
                }
                float vh = (f == 2 || f == 3) ? 1f : y1;
                md.uvs.Add(new Vector2(tu0, tv0)); md.uvs.Add(new Vector2(tu0, tv0 + (tv1 - tv0) * vh)); md.uvs.Add(new Vector2(tu1, tv0 + (tv1 - tv0) * vh)); md.uvs.Add(new Vector2(tu1, tv0));
                for (int k = 0; k < 4; k++) { md.uv2.Add(new Vector2(sk, bk)); md.colors.Add(col); }
                var t = md.tris[sub];
                t.Add(bi); t.Add(bi + 2); t.Add(bi + 1); t.Add(bi); t.Add(bi + 3); t.Add(bi + 2);
                if (f == 2 && water) { t.Add(bi); t.Add(bi + 1); t.Add(bi + 2); t.Add(bi); t.Add(bi + 2); t.Add(bi + 3); }
            }
        }
    }
}
