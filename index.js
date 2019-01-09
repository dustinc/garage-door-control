
const redis = require('redis');
const sub = redis.createClient(process.env.REDISCLOUD_URL);
const pub = redis.createClient(process.env.REDISCLOUD_URL);

const io = require('onoff').Gpio;
const door = new io(4, 'high');
const sensor_a = new io(17, 'in', 'both', { debounceTimeout: 10 });
const sensor_b = new io(27, 'in', 'both', { debounceTimeout: 10 });

const DOOR_STATUS = {
  0: 'CLOSED',
  1: 'IN TRANSIT',
  2: 'OPEN',
};

sub.on('message', (channel, message) => {
  if ('command' !== channel) return;
  if ('GETSTATUS' === message) {
    let door_status = getDoorStatus();
    pub.publish('door_status', door_status);
  }
  else if ('TRIGGERDOOR' === message) {
    triggerDoor();
  }
});

sub.subscribe('command');

const triggerDoor = () => {
  door.writeSync(0);
  setTimeout(() => door.writeSync(1), 500);
  return 'TRIGGERED';
};

const getDoorStatus = () => {
  let door_status = determineDoorStatus(sensor_a.readSync(), sensor_b.readSync());
  return door_status;
};

const determineDoorStatus = (a, b) => {
  console.log(`Sensor A: ${a}, Sensor B: ${b}`);
  let door_status = 0
  if (a && !b) {
    door_status = 0;
  }
  if (!a && b) {
    door_status = 2;
  }
  if (a && b) {
    door_status = 1;
  }
  return DOOR_STATUS[door_status];
};

const publish = (door_status) => {
  pub.set('door-status', door_status);
  pub.publish('door_status', door_status);
};

sensor_a.watch((err, value) => {
  let door_status = determineDoorStatus(value, sensor_b.readSync());
  publish(door_status);
});

sensor_b.watch((err, value) => {
  let door_status = determineDoorStatus(sensor_a.readSync(), value);
  publish(door_status);
});

process.on('SIGINT', () => {
  door.unexport();
  sensor_a.unexport();
  sensor_b.unexport();
});
