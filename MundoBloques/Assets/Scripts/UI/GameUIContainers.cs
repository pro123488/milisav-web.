using UnityEngine;

namespace MundoBloques
{
    public sealed partial class GameUI
    {
        ContainerScreen container;
        RectTransform containerLayer;

        void BuildContainers()
        {
            containerLayer = UIKit.Rect(screenRoot, "containers", 0, 0, 0, 0);
            UIKit.Stretch(containerLayer);
        }

        void Show(ContainerScreen s)
        {
            if (container != null) CloseContainer();
            var g = GameRoot.I;
            if (g.player == null || g.player.dead) return;
            container = s;
            s.Init(this, g.player, containerLayer);
            g.player.StopBreaking(); g.player.CancelUse();
            if (s is CraftingScreen) { var cs = s as CraftingScreen; }
            Sfx.Play(Clip.Chest, g.player.transform.position, 0.3f, 1.4f);
        }

        public void CloseContainer()
        {
            if (container == null) return;
            var c = container;
            container = null;
            c.OnClose();
            if (c.root != null)
            {
                // cursor y tooltip son hermanos del root dentro de containerLayer
                for (int i = containerLayer.childCount - 1; i >= 0; i--) Destroy(containerLayer.GetChild(i).gameObject);
            }
        }

        public void OpenInventory() { Show(new CraftingScreen(2, "Inventario")); }
        public void OpenCrafting() { Show(new CraftingScreen(3, "Mesa de crafteo")); }
        public void OpenStonecutter() { Show(new StonecutterScreen()); }
        public void OpenFurnace(FurnaceEntity f) { Show(new FurnaceScreen(f)); }
        public void OpenChest(ChestEntity c) { Show(new ChestScreen(c)); }
        public void OpenTrade(Mob m) { if (m.villager != null) Show(new TradeScreen(m)); }
        public void OpenCreative() { Show(new CreativeScreen()); }
    }
}
