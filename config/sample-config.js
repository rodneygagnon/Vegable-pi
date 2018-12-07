require("dotenv").config();

module.exports = {
  zones: process.env.VEGABLE_STATIONS || 8,
  https_port: process.env.HTTPS_PORT || 3005,
  cimis_key: process.env.CIMIS_KEY || "7A2AA245-A73C-44AA-8FE5-D1D71510BBE0",

  default_username: "-MAKE-ONE-",
  default_email: "-MAKE-ONE-",
  default_password: "-MAKE-ONE-",
  default_address: "1 Main St",
  default_city: "Sebastopol",
  default_state: "CA",
  default_zip: "95472",
  default_lat: -122.8251,
  default_long: 38.4036,
  default_mapbox_key: "-YOUR-MAPBOX-API-KEY-",
  default_darksky_key: "-YOUR-DARKSKY-API-KEY-"
};
