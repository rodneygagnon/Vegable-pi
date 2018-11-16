THIS JUST THE START OF COMPILING INSTALL NOTES. THIS IS NOT OFFICIAL

References:
* https://blog.alexellis.io/getting-started-with-docker-on-raspberry-pi/
* http://yannickloriot.com/2016/04/install-mongodb-and-node-js-on-a-raspberry-pi/
* https://www.airpair.com/javascript/complete-expressjs-nodejs-mongodb-crud-skeleton
* https://projects.raspberrypi.org/en/projects/lamp-web-server-with-wordpress/5
* https://expressjs.com/en/guide/database-integration.html
* https://medium.com/@sunnykay/docker-development-workflow-node-express-mongo-4bb3b1f7eb1e (docker)
* https://www.npmjs.com/package/pigpio

Procedure:
* On Mac, use Disk Utility to reformat 64gb and higher SD cards to MSDOS FAT32
* Use Etcher to flash latest Raspbian Image currently Stretch 6/27/2018
* > touch ssh in /boot to enable ssh
* Plug in monitor, keyboard, mouse
    * Change password, connect to network, update raspbian
* Change hostname from raspberrypi to vegablepi
    * /etc/hosts and /etc/hostname
* Make headless
    * Add gpu_mem=16 to /boot/config.txt
* Install Netatalk to share files with Mac
    * sudo apt-get install netatalk
* Install docker
    * curl -sSL https://get.docker.com | sh
* Run docker as non root user
    * sudo usermod -aG docker pi
* Configure docker
    * sudo systemctl enable docker
    * sudo systemctl start docker (or reboot the pi)

References:
* https://www.npmjs.com/

* INSTALLING NODE, NPM, SQLite
    * > sudo apt-get install node
    * > sudo apt-get install npm
    * > BUILD & INSTALL INSTALL REDIS

    * > sudo npm install -g express
    * > sudo npm install -g express-generator
    * > sudo npm install -g bootstrap
    *
* Generate express app
    * > express —no-view (to use static html — bootstrap) vegable
    * > cd vegable
    * > npm install redis
    * > npm install pigpio
    * > sudo DEBUG=vegable:* npm start
