// The restricted Windows host cannot answer os.userInfo(). tsx only needs a
// username to choose its temporary-directory name.
const os = require('node:os');

os.userInfo = () => ({
  uid: 1,
  gid: 1,
  username: 'eval',
  homedir: os.tmpdir(),
  shell: null,
});
