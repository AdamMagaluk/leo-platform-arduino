var test = require('tape');
var path = require('path');

var platform = require('../index');

var runtime = {ide : {path: '/path/to/ide', version: '1.5.5'}};
var board = {};
var build = {variant: 'somevariant'};

test("platform returns leo env obj", function(t){

  var env = platform(runtime, build, board);

  t.ok(env.build,'should have build obj on env');
  t.ok(env.runtime,'should have runtime obj on env');
  t.ok(env.recipe,'should have recipe obj on env');
  t.ok(env.compiler,'should have compiler obj on env');
  t.ok(env.includes,'should have includes obj on env');
  t.ok(env.tools,'should have tools obj on env');
  t.ok(env.board,'should have board obj on env');
  t.ok(env.compiler.c, 'should have c compiler');

  t.end();
});

test("platform should detect 1.0.5 vs 1.5.5 path differences", function(t){

  runtime.ide.version = '1.0.2';
  var env105 = platform(runtime, build, board);
  t.equals(env105.compiler.corePath, path.join(runtime.ide.path, 'hardware/arduino/cores/arduino'));

  runtime.ide.version = '1.5.6';
  var env155 = platform(runtime, build, board);
  t.equals(env155.compiler.corePath, path.join(runtime.ide.path, 'hardware/arduino/avr/cores/arduino'));

  t.end();
});
