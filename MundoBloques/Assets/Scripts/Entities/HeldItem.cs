using UnityEngine;

namespace MundoBloques
{
    /// <summary>Objeto que se ve en la mano (primera persona), con animacion de golpe.</summary>
    public sealed class HeldItem : MonoBehaviour
    {
        Player player;
        MeshFilter mf; MeshRenderer mr;
        Item shown; bool wasEmpty = true;
        float swing, bob;
        MaterialPropertyBlock mpb;

        public void Init(Player p)
        {
            player = p;
            var m = new GameObject("model");
            m.transform.SetParent(transform, false);
            mf = m.AddComponent<MeshFilter>(); mr = m.AddComponent<MeshRenderer>();
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            mpb = new MaterialPropertyBlock();
        }

        public void Swing() { swing = 1f; }

        void LateUpdate()
        {
            if (player == null || GameRoot.I == null || GameRoot.I.world == null) return;
            var st = player.inv.Held;
            var it = st.IsEmpty ? null : st.item;
            if (it != shown)
            {
                shown = it;
                if (it == null) mr.enabled = false;
                else
                {
                    mr.enabled = true;
                    mf.sharedMesh = ItemMeshes.Get(it);
                    mr.sharedMaterial = ItemMeshes.IsFlat(it) ? Mats.Item : (it.block != null && (it.block.cutout || it.block.shape == Shape.Cross || it.block.shape == Shape.Torch) ? Mats.Cutout : Mats.Opaque);
                    swing = 0.6f;       // pequeno gesto al cambiar
                }
            }
            if (it == null) return;
            float dt = Time.deltaTime;
            swing = Mathf.Max(0, swing - dt * 4.5f);
            bob += dt * (player.sprinting ? 12f : 8f) * Mathf.Clamp01(new Vector2(player.vel.x, player.vel.z).magnitude);
            bool cube = it.block != null && (it.block.shape == Shape.Cube || it.block.shape == Shape.Box || it.block.shape == Shape.Slab || it.block.shape == Shape.Stairs);
            float s = Mathf.Sin(swing * Mathf.PI);
            float use = player.useTime > 0.05f ? Mathf.Sin(player.useTime * 18f) * 0.03f + 0.12f : 0f;
            Vector3 pos = cube ? new Vector3(0.5f, -0.45f, 0.75f) : new Vector3(0.45f, -0.38f, 0.65f);
            pos += new Vector3(Mathf.Sin(bob) * 0.015f, Mathf.Abs(Mathf.Cos(bob)) * 0.015f, 0);
            pos += new Vector3(-0.15f * s, -0.18f * s, 0.12f * s);
            pos += new Vector3(-0.2f * use, 0.25f * use, 0);
            transform.localPosition = pos;
            bool tool = it.kind == ItemKind.Tool || it.kind == ItemKind.Special;
            transform.localRotation = cube ? Quaternion.Euler(10, -35 + 20 * s, 0) * Quaternion.Euler(-40 * s, 0, 0)
                                           : Quaternion.Euler(-60 * s, tool ? 25 : 0, tool ? -20 : 0);
            transform.localScale = Vector3.one * (cube ? 0.42f : 0.62f);
            mpb.SetFloat("_ObjLight", Mathf.Clamp01(Mathf.Max(player.LightAt(), 0.15f)));
            mr.SetPropertyBlock(mpb);
        }
    }
}
