var arduino150 = require('./lib/platform_150');
var arduino105 = require('./lib/platform_105');

module.exports = function(runtime, build, board){
  if(runtime.ide.version.indexOf('1.5') === 0) {
    return arduino150.apply(this, arguments);
  }else {
    return arduino105.apply(this, arguments);
  }
};



