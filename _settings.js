require("dotenv").config();

module.exports = {
  stations: process.env.VEGABLE_STATIONS || 8,
  https_port: process.env.HTTPS_PORT || 3005,

  // md5 of 'opendoor'
  default_password: "-NOT-CURRENTLY-USED-",
  default_address: "1 Main St",
  default_city: "Sebastopol",
  default_state: "CA",
  default_zip: "95472",
  default_mapbox_key: "-YOUR-MAPBOX-API-KEY-",
  default_darksky_key: "-YOUR-DARKSKY-API-KEY-",
  default_ifttt_url: "maker.ifttt.com"
};
