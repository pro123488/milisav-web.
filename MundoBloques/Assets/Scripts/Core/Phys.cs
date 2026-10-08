using System.Collections.Generic;
using UnityEngine;

namespace MundoBloques
{
    public struct AABB
    {
        public float x0, y0, z0, x1, y1, z1;
        public AABB(float x0, float y0, float z0, float x1, float y1, float z1)
        { this.x0 = x0; this.y0 = y0; this.z0 = z0; this.x1 = x1; this.y1 = y1; this.z1 = z1; }

        public static AABB At(Vector3 feet, float width, float height)
        {
            float h = width * 0.5f;
            return new AABB(feet.x - h, feet.y, feet.z - h, feet.x + h, feet.y + height, feet.z + h);
        }

        public Vector3 Feet { get { return new Vector3((x0 + x1) * 0.5f, y0, (z0 + z1) * 0.5f); } }
        public void Offset(float dx, float dy, float dz) { x0 += dx; x1 += dx; y0 += dy; y1 += dy; z0 += dz; z1 += dz; }
        public AABB Expand(float dx, float dy, float dz)
        {
            var r = this;
            if (dx < 0) r.x0 += dx; else r.x1 += dx;
            if (dy < 0) r.y0 += dy; else r.y1 += dy;
            if (dz < 0) r.z0 += dz; else r.z1 += dz;
            return r;
        }
        public AABB Grow(float g) { return new AABB(x0 - g, y0 - g, z0 - g, x1 + g, y1 + g, z1 + g); }
        public bool Intersects(AABB o) { return o.x1 > x0 && o.x0 < x1 && o.y1 > y0 && o.y0 < y1 && o.z1 > z0 && o.z0 < z1; }
        public Vector3 Center { get { return new Vector3((x0 + x1) * 0.5f, (y0 + y1) * 0.5f, (z0 + z1) * 0.5f); } }

        public float ClipX(AABB o, float dx)
        {
            if (o.y1 <= y0 || o.y0 >= y1 || o.z1 <= z0 || o.z0 >= z1) return dx;
            if (dx > 0 && o.x1 <= x0) { float m = x0 - o.x1; if (m < dx) dx = m; }
            else if (dx < 0 && o.x0 >= x1) { float m = x1 - o.x0; if (m > dx) dx = m; }
            return dx;
        }
        public float ClipY(AABB o, float dy)
        {
            if (o.x1 <= x0 || o.x0 >= x1 || o.z1 <= z0 || o.z0 >= z1) return dy;
            if (dy > 0 && o.y1 <= y0) { float m = y0 - o.y1; if (m < dy) dy = m; }
            else if (dy < 0 && o.y0 >= y1) { float m = y1 - o.y0; if (m > dy) dy = m; }
            return dy;
        }
        public float ClipZ(AABB o, float dz)
        {
            if (o.x1 <= x0 || o.x0 >= x1 || o.y1 <= y0 || o.y0 >= y1) return dz;
            if (dz > 0 && o.z1 <= z0) { float m = z0 - o.z1; if (m < dz) dz = m; }
            else if (dz < 0 && o.z0 >= z1) { float m = z1 - o.z0; if (m > dz) dz = m; }
            return dz;
        }

        /// <summary>Como Ray pero ademas devuelve la cara de la caja que se golpea (0:+X 1:-X 2:+Y 3:-Y 4:+Z 5:-Z; -1 si el origen esta dentro).</summary>
        public float RayFace(Vector3 o, Vector3 d, float max, out int face)
        {
            face = -1;
            float tmin = 0, tmax = max; int axis = -1;
            for (int i = 0; i < 3; i++)
            {
                float oi = i == 0 ? o.x : (i == 1 ? o.y : o.z), di = i == 0 ? d.x : (i == 1 ? d.y : d.z);
                float lo = i == 0 ? x0 : (i == 1 ? y0 : z0), hi = i == 0 ? x1 : (i == 1 ? y1 : z1);
                if (Mathf.Abs(di) < 1e-8f) { if (oi < lo || oi > hi) return -1f; }
                else
                {
                    float t1 = (lo - oi) / di, t2 = (hi - oi) / di;
                    if (t1 > t2) { float t = t1; t1 = t2; t2 = t; }
                    if (t1 > tmin) { tmin = t1; axis = i; }
                    if (t2 < tmax) tmax = t2;
                    if (tmin > tmax) return -1f;
                }
            }
            if (axis == 0) face = d.x > 0 ? 1 : 0;
            else if (axis == 1) face = d.y > 0 ? 3 : 2;
            else if (axis == 2) face = d.z > 0 ? 5 : 4;
            return tmin;
        }

        /// <summary>Interseccion rayo-caja; devuelve la distancia t o -1.</summary>
        public float Ray(Vector3 o, Vector3 d, float max)
        {
            float tmin = 0, tmax = max;
            for (int i = 0; i < 3; i++)
            {
                float oi = i == 0 ? o.x : (i == 1 ? o.y : o.z), di = i == 0 ? d.x : (i == 1 ? d.y : d.z);
                float lo = i == 0 ? x0 : (i == 1 ? y0 : z0), hi = i == 0 ? x1 : (i == 1 ? y1 : z1);
                if (Mathf.Abs(di) < 1e-8f) { if (oi < lo || oi > hi) return -1f; }
                else
                {
                    float t1 = (lo - oi) / di, t2 = (hi - oi) / di;
                    if (t1 > t2) { float t = t1; t1 = t2; t2 = t; }
                    if (t1 > tmin) tmin = t1;
                    if (t2 < tmax) tmax = t2;
                    if (tmin > tmax) return -1f;
                }
            }
            return tmin;
        }
    }

    /// <summary>Fisica de cajas contra bloques (sin colliders de Unity).</summary>
    public static class Phys
    {
        static readonly Box[] tmp = new Box[12];
        static readonly List<AABB> boxes = new List<AABB>(64);
        static readonly List<AABB> boxes2 = new List<AABB>(64);

        public static void Collect(World w, AABB r, List<AABB> into)
        {
            into.Clear();
            int x0 = Mathf.FloorToInt(r.x0), x1 = Mathf.FloorToInt(r.x1 - 0.0001f);
            int y0 = Mathf.FloorToInt(r.y0), y1 = Mathf.FloorToInt(r.y1 - 0.0001f);
            int z0 = Mathf.FloorToInt(r.z0), z1 = Mathf.FloorToInt(r.z1 - 0.0001f);
            for (int z = z0; z <= z1; z++)
                for (int x = x0; x <= x1; x++)
                {
                    if (!w.IsLoaded(x, z)) { into.Add(new AABB(x, -64, z, x + 1, 256, z + 1)); continue; }
                    for (int y = y0 - 1; y <= y1; y++)
                    {
                        bool extra = y == y0 - 1;          // fila inferior: solo vallas y portillos (miden 1,5 de alto)
                        if (extra && y < 0) continue;
                        if (y < 0) { into.Add(new AABB(x, y, z, x + 1, y + 1, z + 1)); continue; }
                        if (y >= 128) continue;
                        ushort id = w.Id(x, y, z);
                        if (id == 0) continue;
                        var b = Block.All[id];
                        if (!b.Collides) continue;
                        if (extra && b.shape != Shape.Fence && b.shape != Shape.Gate) continue;
                        int n = Shapes.Collision(b, w.GetMeta(x, y, z), tmp);
                        for (int i = 0; i < n; i++)
                            into.Add(new AABB(x + tmp[i].x0, y + tmp[i].y0, z + tmp[i].z0, x + tmp[i].x1, y + tmp[i].y1, z + tmp[i].z1));
                    }
                }
        }

        /// <summary>Mueve la caja detectando colisiones con bloques. Devuelve el movimiento real en d.</summary>
        public static void Move(World w, ref AABB box, ref Vector3 d, float stepHeight, bool wasOnGround, out bool onGround, out bool hitH)
        {
            float odx = d.x, ody = d.y, odz = d.z;
            var orig = box;
            Collect(w, box.Expand(d.x, d.y, d.z), boxes);
            float dx = d.x, dy = d.y, dz = d.z;
            for (int i = 0; i < boxes.Count; i++) dy = boxes[i].ClipY(box, dy);
            box.Offset(0, dy, 0);
            for (int i = 0; i < boxes.Count; i++) dx = boxes[i].ClipX(box, dx);
            box.Offset(dx, 0, 0);
            for (int i = 0; i < boxes.Count; i++) dz = boxes[i].ClipZ(box, dz);
            box.Offset(0, 0, dz);
            bool grounded = ody < 0 && dy != ody;
            hitH = dx != odx || dz != odz;

            if (stepHeight > 0f && hitH && (wasOnGround || grounded))
            {
                var b2 = orig;
                float sdx = odx, sdz = odz, sdy = stepHeight;
                Collect(w, b2.Expand(odx, stepHeight, odz), boxes2);
                for (int i = 0; i < boxes2.Count; i++) sdy = boxes2[i].ClipY(b2, sdy);
                b2.Offset(0, sdy, 0);
                for (int i = 0; i < boxes2.Count; i++) sdx = boxes2[i].ClipX(b2, sdx);
                b2.Offset(sdx, 0, 0);
                for (int i = 0; i < boxes2.Count; i++) sdz = boxes2[i].ClipZ(b2, sdz);
                b2.Offset(0, 0, sdz);
                float ddy = -sdy;
                for (int i = 0; i < boxes2.Count; i++) ddy = boxes2[i].ClipY(b2, ddy);
                b2.Offset(0, ddy, 0);
                if (sdx * sdx + sdz * sdz > dx * dx + dz * dz + 1e-6f)
                {
                    box = b2; dx = sdx; dz = sdz; dy = sdy + ddy; grounded = true;
                    hitH = false;
                }
            }
            onGround = grounded;
            d = new Vector3(box.x0 - orig.x0, box.y0 - orig.y0, box.z0 - orig.z0);
        }

        /// <summary>true si la caja choca con algun bloque solido.</summary>
        public static bool Overlaps(World w, AABB box)
        {
            Collect(w, box, boxes);
            for (int i = 0; i < boxes.Count; i++) if (boxes[i].Intersects(box)) return true;
            return false;
        }

        /// <summary>Hay suelo bajo la caja (para el agachado en bordes).</summary>
        public static bool HasGround(World w, AABB box, float depth)
        {
            var below = new AABB(box.x0, box.y0 - depth, box.z0, box.x1, box.y0, box.z1);
            Collect(w, below, boxes);
            return boxes.Count > 0;
        }

        // ------------- rayos sobre bloques -------------
        public struct Hit
        {
            public bool hit; public int x, y, z, face; public float dist; public Vector3 point; public Block block;
        }

        /// <summary>Rayo con DDA. includeFluids para cubos de agua/lava.</summary>
        public static Hit Raycast(World w, Vector3 o, Vector3 dir, float max, bool includeFluids)
        {
            var h = new Hit();
            dir = dir.normalized;
            int x = Mathf.FloorToInt(o.x), y = Mathf.FloorToInt(o.y), z = Mathf.FloorToInt(o.z);
            int sx = dir.x > 0 ? 1 : -1, sy = dir.y > 0 ? 1 : -1, sz = dir.z > 0 ? 1 : -1;
            float tdx = Mathf.Abs(dir.x) < 1e-8f ? float.MaxValue : Mathf.Abs(1f / dir.x);
            float tdy = Mathf.Abs(dir.y) < 1e-8f ? float.MaxValue : Mathf.Abs(1f / dir.y);
            float tdz = Mathf.Abs(dir.z) < 1e-8f ? float.MaxValue : Mathf.Abs(1f / dir.z);
            float tmx = dir.x > 0 ? (x + 1 - o.x) * tdx : (o.x - x) * tdx;
            float tmy = dir.y > 0 ? (y + 1 - o.y) * tdy : (o.y - y) * tdy;
            float tmz = dir.z > 0 ? (z + 1 - o.z) * tdz : (o.z - z) * tdz;
            if (Mathf.Abs(dir.x) < 1e-8f) tmx = float.MaxValue;
            if (Mathf.Abs(dir.y) < 1e-8f) tmy = float.MaxValue;
            if (Mathf.Abs(dir.z) < 1e-8f) tmz = float.MaxValue;
            float t = 0; int face = -1;
            for (int i = 0; i < 200; i++)
            {
                if (y >= 0 && y < 128)
                {
                    var b = w.GetBlock(x, y, z);
                    if (b.id != 0 && (!b.fluid || includeFluids) && (b.shape != Shape.Portal || false))
                    {
                        int bf;
                        float tt = RayBlock(w, b, x, y, z, o, dir, max, out bf);
                        if (tt >= 0 && tt <= max)
                        {
                            h.hit = true; h.x = x; h.y = y; h.z = z; h.block = b; h.dist = tt; h.point = o + dir * tt;
                            h.face = bf >= 0 ? bf : (face >= 0 ? face : FaceFromPoint(h.point, x, y, z));
                            return h;
                        }
                    }
                }
                if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; face = sx > 0 ? 1 : 0; }
                else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; face = sy > 0 ? 3 : 2; }
                else { z += sz; t = tmz; tmz += tdz; face = sz > 0 ? 5 : 4; }
                if (t > max) break;
            }
            return h;
        }

        static int FaceFromPoint(Vector3 p, int x, int y, int z)
        {
            float dx0 = Mathf.Abs(p.x - x), dx1 = Mathf.Abs(p.x - (x + 1)), dy0 = Mathf.Abs(p.y - y), dy1 = Mathf.Abs(p.y - (y + 1)), dz0 = Mathf.Abs(p.z - z), dz1 = Mathf.Abs(p.z - (z + 1));
            float m = Mathf.Min(Mathf.Min(Mathf.Min(dx0, dx1), Mathf.Min(dy0, dy1)), Mathf.Min(dz0, dz1));
            if (m == dx1) return 0; if (m == dx0) return 1; if (m == dy1) return 2; if (m == dy0) return 3; if (m == dz1) return 4; return 5;
        }

        static float RayBlock(World w, Block b, int x, int y, int z, Vector3 o, Vector3 d, float max, out int boxFace)
        {
            int n;
            boxFace = -1;
            if (b.shape == Shape.Cross || b.shape == Shape.Crop || b.fluid)
            {
                var bb = b.fluid ? new AABB(x, y, z, x + 1, y + 1, z + 1) : new AABB(x + 0.12f, y, z + 0.12f, x + 0.88f, y + 0.8f, z + 0.88f);
                return bb.RayFace(o, d, max, out boxFace);
            }
            n = Shapes.Boxes(b, w.GetMeta(x, y, z), tmp);
            if (n == 0) { return new AABB(x, y, z, x + 1, y + 1, z + 1).RayFace(o, d, max, out boxFace); }
            float best = -1f;
            for (int i = 0; i < n; i++)
            {
                var bb = new AABB(x + tmp[i].x0, y + tmp[i].y0, z + tmp[i].z0, x + tmp[i].x1, y + tmp[i].y1, z + tmp[i].z1);
                int fc;
                float t = bb.RayFace(o, d, max, out fc);
                if (t >= 0 && (best < 0 || t < best)) { best = t; boxFace = fc; }
            }
            return best;
        }
    }
}
