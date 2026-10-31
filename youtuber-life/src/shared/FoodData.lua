--!nonstrict
-- FoodData: comida, recetas y menús. Los alimentos son objetos del inventario (categoría "food")
-- que se consumen. Energía y ánimo tienen efectos moderados y nunca impiden jugar.

local FoodData = {}

-- Ingredientes y productos del supermercado: { id, nombre, precio, energía, ánimo }
FoodData.Groceries = {
	{ "food_eggs", "Huevos (6)", 4, 6, 1 }, { "food_bread", "Pan", 2, 6, 1 }, { "food_tomato", "Tomates", 3, 3, 1 },
	{ "food_pasta", "Pasta", 3, 8, 1 }, { "food_rice", "Arroz", 3, 8, 1 }, { "food_chicken", "Pollo", 8, 10, 2 },
	{ "food_veggies", "Verduras variadas", 5, 5, 2 }, { "food_cheese", "Queso", 5, 6, 2 }, { "food_milk", "Leche", 2, 5, 1 },
	{ "food_fruit", "Fruta fresca", 4, 6, 3 }, { "food_flour", "Harina", 2, 2, 0 }, { "food_fish", "Pescado", 10, 10, 2 },
	{ "food_water", "Agua", 1, 4, 1 }, { "food_juice", "Zumo", 3, 8, 3 }, { "food_bar", "Barrita energética", 3, 18, 1 },
	{ "food_chips", "Patatas fritas", 2, 6, 4 }, { "food_soda", "Refresco", 2, 8, 3 }, { "food_sandwich", "Bocadillo", 5, 16, 3 },
}

-- Platos cocinados en casa (no se venden: se cocinan) o pedidos a domicilio
FoodData.Meals = {
	{ "meal_omelette", "Tortilla de patatas", 30, 10 }, { "meal_pasta", "Pasta con tomate", 34, 9 },
	{ "meal_chickenrice", "Arroz con pollo", 42, 12 }, { "meal_salad", "Ensalada fresca", 22, 14 },
	{ "meal_pizza", "Pizza casera", 38, 18 }, { "meal_fish", "Pescado al horno", 44, 14 },
	{ "meal_smoothie", "Batido de frutas", 20, 16 }, { "meal_gourmet", "Sándwich gourmet", 36, 15 },
	{ "meal_burger", "Hamburguesa a domicilio", 36, 16 }, { "meal_sushi", "Sushi a domicilio", 34, 20 },
	{ "meal_noodles", "Fideos a domicilio", 32, 14 },
}

FoodData.Recipes = {
	{ Id = "meal_omelette", Needs = { "food_eggs", "food_veggies" }, Time = 3 },
	{ Id = "meal_pasta", Needs = { "food_pasta", "food_tomato" }, Time = 3 },
	{ Id = "meal_chickenrice", Needs = { "food_rice", "food_chicken", "food_veggies" }, Time = 5 },
	{ Id = "meal_salad", Needs = { "food_veggies", "food_tomato", "food_cheese" }, Time = 2 },
	{ Id = "meal_pizza", Needs = { "food_flour", "food_tomato", "food_cheese" }, Time = 5 },
	{ Id = "meal_fish", Needs = { "food_fish", "food_veggies" }, Time = 4 },
	{ Id = "meal_smoothie", Needs = { "food_fruit", "food_milk" }, Time = 1 },
	{ Id = "meal_gourmet", Needs = { "food_bread", "food_cheese", "food_chicken" }, Time = 2 },
}

-- Menús de lugares (se comen allí mismo): { id, nombre, precio, energía, ánimo }
FoodData.Menus = {
	restaurant = { Name = "Restaurante La Plaza", Items = {
		{ "r_menu", "Menú del día", 14, 40, 14 }, { "r_paella", "Paella", 18, 42, 18 }, { "r_steak", "Filete con patatas", 22, 48, 16 },
		{ "r_dessert", "Postre de la casa", 6, 10, 14 }, { "r_tasting", "Menú degustación", 60, 55, 30 } } },
	cafe = { Name = "Cafetería", Items = {
		{ "c_coffee", "Café", 2, 12, 5 }, { "c_latte", "Café con leche", 3, 14, 6 }, { "c_croissant", "Cruasán", 3, 12, 6 },
		{ "c_cake", "Tarta", 5, 14, 10 }, { "c_tea", "Té", 2, 8, 6 } } },
	vending = { Name = "Máquina expendedora", Items = {
		{ "v_water", "Agua", 1, 4, 1 }, { "v_soda", "Refresco", 2, 8, 3 }, { "v_bar", "Barrita energética", 3, 18, 1 }, { "v_chips", "Patatas fritas", 2, 6, 4 } } },
}
FoodData.Delivery = { Fee = 5, Seconds = 60, Items = { "meal_burger", "meal_sushi", "meal_noodles", "meal_pizza" }, Prices = { meal_burger = 12, meal_sushi = 16, meal_noodles = 11, meal_pizza = 14 } }

return FoodData
