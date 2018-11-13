require("dotenv").config();

module.exports = {
  stations: process.env.VEGABLE_STATIONS || 8,
  https_port: process.env.HTTPS_PORT || 3005,

  // md5 of 'opendoor'
  default_password: "a6d82bced638de3def1e9bbb4983225c",
  default_address: "1 Main St",
  default_city: "Sebastopol",
  default_state: "CA",
  default_zip: "95472",
  default_mapbox_key: "pk.eyJ1Ijoicm9kbmV5Z2Fnbm9uIiwiYSI6ImNqbmFoY2d4NDAwYXozdnFvY2RoYTQ2MG0ifQ.rE3tLvCEVDr9BHo19Oyl-g",
  default_darksky_key: "487c5a5c36674d394bf8a8641a83c606",
  default_ifttt_url: "maker.ifttt.com"
};
