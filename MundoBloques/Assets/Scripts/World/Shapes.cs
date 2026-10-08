namespace MundoBloques
{
    public struct Box
    {
        public float x0, y0, z0, x1, y1, z1;
        public int tile;      // -1 = la textura del bloque
        public Box(float x0, float y0, float z0, float x1, float y1, float z1, int tile = -1)
        { this.x0 = x0; this.y0 = y0; this.z0 = z0; this.x1 = x1; this.y1 = y1; this.z1 = z1; this.tile = tile; }
    }

    /// <summary>Cajas (render y colision) de cada forma de bloque.</summary>
    public static class Shapes
    {
        public const float DoorThick = 0.1875f;

        public static Box DoorBox(int meta)
        {
            int f = meta & 3; bool open = (meta & 4) != 0;
            float t = DoorThick;
            if (!open)
            {
                switch (f)
                {
                    case 0: return new Box(0, 0, 1 - t, 1, 1, 1);
                    case 1: return new Box(1 - t, 0, 0, 1, 1, 1);
                    case 2: return new Box(0, 0, 0, 1, 1, t);
                    default: return new Box(0, 0, 0, t, 1, 1);
                }
            }
            switch (f)
            {
                case 0: return new Box(0, 0, 0, t, 1, 1);
                case 1: return new Box(0, 0, 1 - t, 1, 1, 1);
                case 2: return new Box(1 - t, 0, 0, 1, 1, 1);
                default: return new Box(0, 0, 0, 1, 1, t);
            }
        }

        static int Stairs(int meta, Box[] o)
        {
            int f = meta & 3; bool flip = (meta & 4) != 0;
            float by0 = flip ? 0.5f : 0f, by1 = flip ? 1f : 0.5f;
            float sy0 = flip ? 0f : 0.5f, sy1 = flip ? 0.5f : 1f;
            o[0] = new Box(0, by0, 0, 1, by1, 1);
            switch (f)
            {
                case 0: o[1] = new Box(0, sy0, 0.5f, 1, sy1, 1); break;
                case 1: o[1] = new Box(0.5f, sy0, 0, 1, sy1, 1); break;
                case 2: o[1] = new Box(0, sy0, 0, 1, sy1, 0.5f); break;
                default: o[1] = new Box(0, sy0, 0, 0.5f, sy1, 1); break;
            }
            return 2;
        }

        /// <summary>Cajas de render (o[] debe tener al menos 4 posiciones).</summary>
        public static int Boxes(Block b, int meta, Box[] o)
        {
            switch (b.shape)
            {
                case Shape.Cube: o[0] = new Box(0, 0, 0, 1, 1, 1); return 1;
                case Shape.Box:
                    o[0] = new Box(b.inset, 0, b.inset, 1 - b.inset, b.height, 1 - b.inset);
                    if (b == B.EndFrame && (meta & 1) != 0)
                    {
                        o[1] = new Box(0.3125f, b.height, 0.3125f, 0.6875f, b.height + 0.1875f, 0.6875f, TileAtlas.EndEye);
                        return 2;
                    }
                    return 1;
                case Shape.Slab:
                    if ((meta & 1) != 0) o[0] = new Box(0, 0.5f, 0, 1, 1, 1); else o[0] = new Box(0, 0, 0, 1, 0.5f, 1);
                    return 1;
                case Shape.Stairs: return Stairs(meta, o);
                case Shape.Door: o[0] = DoorBox(meta); return 1;
                case Shape.Torch:
                    {
                        float c = 0.5f, h = 0.4375f, w = 0.0625f;
                        float ox = 0, oz = 0, oy = 0;
                        switch (meta)
                        {
                            case 1: ox = -0.3f; oy = 0.2f; break;
                            case 2: ox = 0.3f; oy = 0.2f; break;
                            case 3: oz = -0.3f; oy = 0.2f; break;
                            case 4: oz = 0.3f; oy = 0.2f; break;
                        }
                        o[0] = new Box(c - w + ox, oy, c - w + oz, c + w + ox, oy + h * 2f, c + w + oz);
                        return 1;
                    }
                case Shape.Portal:
                    if ((meta & 1) == 0) o[0] = new Box(0, 0, 0.375f, 1, 1, 0.625f); else o[0] = new Box(0.375f, 0, 0, 0.625f, 1, 1);
                    return 1;
            }
            return 0;
        }

        /// <summary>Cajas de colision.</summary>
        public static int Collision(Block b, int meta, Box[] o)
        {
            if (!b.Collides) return 0;
            switch (b.shape)
            {
                case Shape.Cube: o[0] = new Box(0, 0, 0, 1, 1, 1); return 1;
                case Shape.Box:
                    if (b == B.EndPortal) return 0;
                    o[0] = new Box(b.inset, 0, b.inset, 1 - b.inset, b.height, 1 - b.inset); return 1;
                case Shape.Slab:
                    if ((meta & 1) != 0) o[0] = new Box(0, 0.5f, 0, 1, 1, 1); else o[0] = new Box(0, 0, 0, 1, 0.5f, 1);
                    return 1;
                case Shape.Stairs: return Stairs(meta, o);
                case Shape.Door: o[0] = DoorBox(meta); return 1;
            }
            return 0;
        }
    }
}
