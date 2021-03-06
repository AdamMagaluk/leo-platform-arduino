var path = require('path');
var traverse = require('traverse');
var Handlebars = require('handlebars');

module.exports = function(config, build, board){
  config.platform = {};

  build.arch = 'AVR';
  build.path = './.build';

  // USB Default Flags
  // Default blank usb manufacturer will be filled it at compile time
  // - from numeric vendor ID, set to Unknown otherwise
  build.usb_manufacturer = '';
  if(build.use_usb_flags){
    //-DUSB_VID=2341 -DUSB_PID=0x8041 -DUSB_MANUFACTURER=\'""\' -DUSB_PRODUCT=\'"Arduino Yun"\' 
    build.usb_flags = Handlebars.compile('-DUSB_VID={{build.vid}} -DUSB_PID={{build.pid}} -DUSB_MANUFACTURER=\'"{{build.usb_manufacturer}}"\' -DUSB_PRODUCT=\'"{{build.usb_product}}"\'')({build : build});
    if(!build.extra_flags)
      build.extra_flags = build.usb_flags;
    else
      build.extra_flags += ' ' + build.usb_flags;
  }


  var compiler = {c : { elf : {}}, S : {}, cpp : {}, ar : {}, objcopy : {eep : {}}, elf2hex : {}, ldflags : '', size : {} };

  var recipe = {c : {o : {},combine : {}},cpp : {o : {}}, S : {o : {}}, ar : {}, objcopy : {eep : {},hex : {}},size : {regex : {}}};

  var tools = {avrdude : {cmd : {},config : {},upload : {params : {}}, program : {params : {}},erase : {params : {}}, bootloader : {params : {}}   }};

  var includes = [];
  
  compiler.c.cmd = 'avr-gcc';
  compiler.c.flags = '-std=gnu99 -c -g -Os -w -ffunction-sections -fdata-sections -MMD';
  compiler.c.elf.flags = '-Os -Wl,--gc-sections';
  compiler.c.elf.cmd = 'avr-gcc';
  compiler.S.flags = '-c -g -x assembler-with-cpp';
  compiler.cpp.cmd = 'avr-g++';
  compiler.cpp.flags = '-std=gnu++98 -c -g -Os -w -fno-exceptions -ffunction-sections -fdata-sections -MMD';
  compiler.ar.cmd = 'avr-ar';
  compiler.ar.flags = 'rcs';
  compiler.objcopy.cmd = 'avr-objcopy';
  compiler.objcopy.eep.flags = '-O ihex -j .eeprom --set-section-flags=.eeprom=alloc,load --no-change-warnings --change-section-lma .eeprom=0';
  compiler.elf2hex.flags = '-O ihex -R .eeprom';
  compiler.elf2hex.cmd = 'avr-objcopy';
  compiler.ldflags = '';
  compiler.size.cmd = 'avr-size';

  // These can be overridden in platform.local.txt
  compiler.c.extra_flags = '';
  compiler.c.elf.extra_flags = '';
  compiler.S.extra_flags = '';
  compiler.cpp.extra_flags = '';
  compiler.ar.extra_flags = '';
  compiler.objcopy.eep.extra_flags = '';
  compiler.elf2hex.extra_flags = '';

  // AVR compile patterns
  // --------------------
  
  //// Compile c files
  recipe.c.o.pattern = '"{{{compiler.path}}}/{{{compiler.c.cmd}}}" {{{compiler.c.flags}}} -mmcu={{{build.mcu}}} -DF_CPU={{{build.f_cpu}}} -DARDUINO={{{config.ide.version}}} -DARDUINO_{{{build.board}}} -DARDUINO_ARCH_{{{build.arch}}} {{{compiler.c.extra_flags}}} {{{build.extra_flags}}} {{{includes}}} "{{{source_file}}}" -o "{{{object_file}}}"';

  //// Compile c++ files
  recipe.cpp.o.pattern = '"{{{compiler.path}}}/{{{compiler.cpp.cmd}}}" {{{compiler.cpp.flags}}} -mmcu={{{build.mcu}}} -DF_CPU={{{build.f_cpu}}} -DARDUINO={{{config.ide.version}}} -DARDUINO_{{{build.board}}} -DARDUINO_ARCH_{{{build.arch}}} {{{compiler.cpp.extra_flags}}} {{{build.extra_flags}}} {{{includes}}} "{{{source_file}}}" -o "{{{object_file}}}"';

  //// Compile S files
  recipe.S.o.pattern = '"{{{compiler.path}}}/{{{compiler.c.cmd}}}" {{{compiler.S.flags}}} -mmcu={{{build.mcu}}} -DF_CPU={{{build.f_cpu}}} -DARDUINO={{{config.ide.version}}} -DARDUINO_{{{build.board}}} -DARDUINO_ARCH_{{{build.arch}}} {{{compiler.S.extra_flags}}} {{{build.extra_flags}}} {{{includes}}} "{{{source_file}}}" -o "{{{object_file}}}"';

  //// Create archives
  recipe.ar.pattern = '"{{{compiler.path}}}/{{{compiler.ar.cmd}}}" {{{compiler.ar.flags}}} {{{compiler.ar.extra_flags}}} "{{{build.path}}}/{{{archive_file}}}" "{{{object_file}}}"';

  //// Combine gc-sections, archives, and objects
  recipe.c.combine.pattern = '"{{{compiler.path}}}/{{{compiler.c.elf.cmd}}}" {{{compiler.c.elf.flags}}} -mmcu={{{build.mcu}}} {{{compiler.c.elf.extra_flags}}} -o "{{{build.path}}}/{{{build.project_name}}}.elf" {{{object_files}}} "{{{build.path}}}/{{{archive_file}}}" "-L{{{build.path}}}" -lm';

  //// Create eeprom
  recipe.objcopy.eep.pattern = '"{{{compiler.path}}}/{{{compiler.objcopy.cmd}}}" {{{compiler.objcopy.eep.flags}}} {{{compiler.objcopy.eep.extra_flags}}} "{{{build.path}}}/{{{build.project_name}}}.elf" "{{{build.path}}}/{{{build.project_name}}}.eep"';

  //// Create hex
  recipe.objcopy.hex.pattern = '"{{{compiler.path}}}/{{{compiler.elf2hex.cmd}}}" {{{compiler.elf2hex.flags}}} {{{compiler.elf2hex.extra_flags}}} "{{{build.path}}}/{{{build.project_name}}}.elf" "{{{build.path}}}/{{{build.project_name}}}.hex"';

  //// Compute size
  recipe.size.pattern = '"{{{compiler.path}}}/{{{compiler.size.cmd}}}" -A "{{{build.path}}}/{{{build.project_name}}}.elf"';
  recipe.size.regex.regex = /^(?:\.text|\.data|\.bootloader)\s+([0-9]+).*/;
  recipe.size.regex.data = /^(?:\.data|\.bss|\.noinit)\s+([0-9]+).*/;
  recipe.size.regex.eeprom = /^(?:\.eeprom)\s+([0-9]+).*/;


  // compile hbs templates for recipe
  compileTemplates(recipe);

  // AVR Uploader/Programmers tools
  // ------------------------------
  compiler.avrdudeconfig = path.join(config.ide.path,'hardware/tools/avr/etc/avrdude.conf');
  //tools.avrdude.cmd.path.linux = '{{{config.ide.path}}}/hardware/tools/avrdude';
  //tools.avrdude.config.path.linux = '{{{config.ide.path}}}/hardware/tools/avrdude.conf';

  tools.avrdude.upload.pattern = '"{{{compiler.path}}}/avrdude" "-C{{{compiler.avrdudeconfig}}}" -p{{{build.mcu}}} -c{{{board.upload.protocol}}} -P{{{serialPort}}} -b{{{board.upload.speed}}} -D "-Uflash:w:{{{build.path}}}/{{{build.project_name}}}.hex:i"';

  tools.avrdude.program.pattern = '"{{{compiler.path}}}/avrdude" "-C{{{compiler.avrdudeconfig}}}" -v -v -v -v -p{{{build.mcu}}} -c{{{board.upload.protocol}}} {{{program.extra_params}}} "-Uflash:w:{{{build.path}}}/{{{build.project_name}}}.hex:i"';

  tools.avrdude.erase.pattern = '"{{{compiler.path}}}/avrdude" "-C{{{compiler.avrdudeconfig}}}" -v -v -v -v -p{{{build.mcu}}} -c{{{board.upload.protocol}}} {{{program.extra_params}}} -e -Ulock:w:{{{board.bootloader.unlock_bits}}}:m -Uefuse:w:{{{bootloader.extended_fuses}}}:m -Uhfuse:w:{{{bootloader.high_fuses}}}:m -Ulfuse:w:{{{bootloader.low_fuses}}}:m';

  tools.avrdude.bootloader.pattern = '"{{{compiler.path}}}/avrdude" "-C{{{compiler.avrdudeconfig}}}" -v -v -v -v -p{{{build.mcu}}} -c{{{board.upload.protocol}}} {{{program.extra_params}}} "-Uflash:w:{{{config.platform.path}}}/bootloaders/{{{board.bootloader.file}}}:i" -Ulock:w:{{{board.bootloader.lock_bits}}}:m';

  // create hbs template to tools
  compileTemplates(tools);

  // env returned to the build step
  return {build : build, 
	  runtime : config,
	  recipe : recipe,
	  compiler : compiler,
	  includes : includes,
	  board : board,
	  tools : tools,  
	  config: config
	 };
}

function compileTemplates(obj){
  traverse(obj).forEach(function (str) {
    if(!this.isLeaf)
      return;
    
    if(this.key !== 'pattern')
      return;
    
    this.update(Handlebars.compile(str));
  });

}
