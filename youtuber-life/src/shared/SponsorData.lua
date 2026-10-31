--!nonstrict
-- SponsorData: marcas completamente ficticias que ofrecen contratos de patrocinio.
-- Tipos de oferta:
--   gift     = te regalan un producto y te pagan por una reseña/vídeo que lo muestre
--   loan     = te prestan equipo caro; se devuelve al terminar el contrato
--   campaign = pago por publicar en una categoría con calidad mínima (sin producto)

local SponsorData = {}

SponsorData.Brands = {
	{ Id = "nexo", Name = "Nexo", Field = "Computadores", Cats = { "tech", "review", "unboxing", "compare" }, Products = { "pc_home", "pc_office", "kb_mech", "mouse_gamer" }, MinRep = 0 },
	{ Id = "pixelia", Name = "Pixelia", Field = "Cámaras", Cats = { "tech", "review", "unboxing", "adventure" }, Products = { "cam_basic", "cam_action", "console_handheld", "drone_mini" }, MinRep = 0 },
	{ Id = "orbis", Name = "Orbis", Field = "Teléfonos y portátiles", Cats = { "tech", "review", "unboxing", "compare", "budget" }, Products = { "phone_mid", "lap_basic", "tab_basic", "earbuds" }, MinRep = 10 },
	{ Id = "zenit", Name = "Zenit", Field = "Tecnología premium", Cats = { "tech", "review", "compare", "luxury" }, Products = { "phone_pro", "lap_ultra", "tv_65", "soundbar" }, MinRep = 25 },
	{ Id = "lumina", Name = "Lumina", Field = "Equipo de vídeo", Cats = { "tech", "tutorial", "review" }, Products = { "cam_vlog", "light_panel", "mon_pro27" }, MinRep = 20 },
	{ Id = "kairo", Name = "Kairo", Field = "Gaming", Cats = { "gaming", "tech", "review", "unboxing" }, Products = { "pc_gamer", "lap_gamer", "pad_pro", "chair_gamer" }, MinRep = 15 },
	{ Id = "ferro", Name = "Ferro", Field = "Aventura y resistencia", Cats = { "adventure", "nature", "travel", "challenge" }, Products = { "cam_outdoor", "phone_rugged", "watch_fit", "spk_bt" }, MinRep = 10 },
	{ Id = "aurea", Name = "Aurea", Field = "Lujo", Cats = { "luxury", "fashion", "review" }, Products = { "watch_lux", "pc_lux", "case_glass" }, MinRep = 45 },
	{ Id = "sabor", Name = "Sabor Brisa", Field = "Restaurantes", Cats = { "food", "cooking", "vlog" }, Products = {}, MinRep = 0 },
	{ Id = "modanova", Name = "ModaNova", Field = "Moda", Cats = { "fashion", "shopping", "vlog" }, Products = {}, MinRep = 5 },
	{ Id = "ruta", Name = "Ruta Viajes", Field = "Turismo", Cats = { "travel", "tourism", "places" }, Products = {}, MinRep = 5 },
	{ Id = "hogarvivo", Name = "Hogar Vivo", Field = "Decoración", Cats = { "decor", "home", "tutorial" }, Products = { "dec_sofa_modern", "dec_lamp_modern", "dec_art_modern" }, MinRep = 0 },
}
SponsorData.BrandById = {}
for _, b in ipairs(SponsorData.Brands) do
	SponsorData.BrandById[b.Id] = b
end

SponsorData.OffersPerDay = 3
SponsorData.MaxActive = 3

return SponsorData
