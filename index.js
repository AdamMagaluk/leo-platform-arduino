var arduino150 = require('./lib/platform_150');
var arduino105 = require('./lib/platform_105');

module.exports = function(runtime, build, board){

  // test for new beta version or nightly builds
  if(/^(1.5|nightly)/.test(runtime.ide.version)){
    return arduino150.apply(this, arguments);
  }else {
    return arduino105.apply(this, arguments);
  }
};



