require("dotenv").config();

module.exports = {
  zones: process.env.VEGABLE_STATIONS || 8,
  https_port: process.env.HTTPS_PORT || 3005,

  // md5 of 'opendoor'
  default_username: "-MAKE-ONE-",
  default_password: "-MAKE-ONE-",
  default_address: "1 Main St",
  default_city: "Sebastopol",
  default_state: "CA",
  default_zip: "95472",
  default_mapbox_key: "-YOUR-MAPBOX-API-KEY-",
  default_darksky_key: "-YOUR-DARKSKY-API-KEY-"
};
