var path = require('path');
var platform  = require('./platform');

module.exports = function(runtime, build, board){
  
  var env = platform(runtime, build, board);
  
  env.compiler.path = path.join(env.runtime.ide.path, 'hardware/tools/avr/bin');
  env.compiler.corePath = path.join(env.runtime.ide.path, 'hardware/arduino/avr/cores/arduino');

  env.includes.push(env.compiler.corePath);
  env.includes.push(path.join(env.runtime.ide.path, 'hardware/arduino/avr/variants', env.build.variant));

  env.runtime.platform.path = path.join(env.runtime.ide.path, 'hardware/arduino/avr');

  return env;
}





