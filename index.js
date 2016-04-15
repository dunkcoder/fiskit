// ��չfis��һЩ��������
var fiskit = module.exports = require('fis3');
fiskit.require.prefixes.unshift('fk');
fiskit.configName = 'fk-conf';
fiskit.cli.name = 'fk';
//fiskit.cli.help.commands = [ 'release', 'install', 'server', 'init' ];
fiskit.cli.info = require('./package.json');
fiskit.cli.version = require('./lib/logo');

// alias
Object.defineProperty(global, 'fiskit', {
    enumerable: true,
    writable: false,
    value: fiskit
});

// ���ȫ�ֺ���
fiskit.set('project.ignore', fiskit.get('project.ignore').concat([
    '{README,readme}.md',
    'fk-conf.js',
    '*.iml',
    '_docs/**'
]));

var config, currentMedia, cdnUrl;

// ���Զ���fis����
fiskit.amount = function(cfg, callback) {
    // ��ȡĬ�������ļ�
    config = require('./lib/config');

    // �ϲ���������
    fiskit.util.merge(config, cfg);

    setDefault();

    initGlobal();

    initOptimizer();

    callback && callback();
};

// Ĭ������
function setDefault() {
    cdnUrl = config.cdnUrl + (config.version ? '/' + config.version : '');
    currentMedia = fiskit.project.currentMedia();

    // ��ȡrelease�������
    config.cdn = fiskit.get('--domain') ? true : config.cdn;
    config.packed = fiskit.get('--pack') ? true : config.packed;

    // ����ģ�黯���
    if(config.modules) {
        fiskit.hook(config.modules.mode, config.modules);
        // widget��components����jsģ�黯
        fiskit.match('/{widget,static/components}/**.js', {
            isMod: true
        });
    }

    // vm�����²�����vm��parser
    if(currentMedia === 'vm') {
        config.velocity.parse = false;
    }

    // ��̬��Դ���ز��
    fiskit.match('::packager', {
        postpackager: fiskit.plugin('loader', {
            resourceType: config.modules ? config.modules.mode : 'auto',
            useInlineMap: true
        }),
        spriter: fiskit.plugin('csssprites')
    });
}

// ȫ������
function initGlobal() {
    fiskit
        // ���»��߿�ͷ�Ĳ�����
        .match('**/_*', {
            release: false
        }, true)
        // �ر�md5
        .match('*', {
            useHash: false,
            // ����������cdn�����ÿ���
            domain: currentMedia !== 'dev' ? cdnUrl : (config.cdn ? cdnUrl : '')
        })
        // ��̬��Դ��md5
        .match('*.{css,scss,js,png,jpg,gif}', {
            useHash: config.useHash
        })
        // �����ļ������ֻ��dev������Ҫ��
        .match('{server.conf,map.json}', {
            release: currentMedia === 'dev' ? '/config/$0' : false
        })
        // ����mock�ļ���widget��vm�ļ�
        .match('{/widget/**.{mock,json,vm},/page/**.{json,mock},/page/macro.vm}', {
            release: false
        })
        // ����css sprite
        .match('*.{css,scss}', {
            sprite: true
        })
        // sass
        .match('*.scss', {
            parser: fiskit.plugin('node-sass', {
                outputStyle: 'expanded'
            }),
            rExt: '.css'
        })
        // ���velocityģ������
        .match('*.vm', {
            parser: fiskit.plugin('velocity', config.velocity),
            rExt: '.html',
            loaderLang: 'html'
        })
        .match('/page/(**.vm)', {
            release: '$1'
        })

    // ��̬��Դ����Ҫvm��test����
    if(currentMedia === 'debug' || currentMedia === 'prod') {
        fiskit.match('/{page/**.vm,test/**,mock/**}', {
            release: false
        })
    }

    // vm������Ҫ����vm�ļ�
    if(currentMedia === 'vm') {
        fiskit
            .match('*.vm', {
                rExt: '.vm'
            })
            .match('/widget/**.vm', {
                release: '$0'
            })
    }

    dealDeploy();
}

function dealDeploy() {
    /**
     * ����fis3-deploy-replace���
     * @param opt {Object|Array}
     * @example
     *   { from: 'a', to: 'b' } or [ { from: 'a', to: 'b' }, { from: 'a0', to: 'b0' }]
     */
    var replacer = function(opt) {
        var r = [];
        if(!opt) {
            return r;
        }
        if(!Array.isArray(opt)) {
            opt = [opt];
        }
        opt.forEach(function(raw) {
            r.push(fiskit.plugin('replace', raw));
        });
        return r;
    };

    // ��������������Ŀ¼������
    if(currentMedia === 'dev') {
        config.devPath && fiskit.match('*', {
            deploy: fiskit.plugin('local-deliver', {
                to: config.devPath
            })
        });
    }
    // vm������֧���ļ������滻
    else if (currentMedia === 'vm') {
        fiskit.match('*.vm', {
            deploy: replacer(config.replace).concat(fiskit.plugin('local-deliver', {
                to: config.deploy.vmTo ? config.deploy.vmTo : 'output/template/' + config.version
            }))
        })
    }
    // Ĭ�Ϸ�����mediaĿ¼
    else {
        fiskit.match('*', {
            deploy: fiskit.plugin('local-deliver', {
                to: config.deploy.staticTo ? config.deploy.staticTo : 'output/' + currentMedia + '/' + config.version
            })
        })
    }
}

// ����ѹ���ʹ��
function initOptimizer() {
    if(currentMedia === 'vm' || currentMedia === 'prod') {
        fiskit
            .match('*.{js,vm:js,html:js}', {
                optimizer: fis.plugin('uglify-js', {
                    mangle: ['require', 'define']
                })
            })
            .match('*.{scss,css,vm:css,vm:scss,html:css,html:scss}', {
                optimizer: fis.plugin('clean-css')
            })
            .match('*.png', {
                optimizer: fis.plugin('png-compressor')
            })
    }

    // ������ã�Ĭ��Ϊnull�޴������
    // media('dev')����ֻ��config.packedΪtrueʱ���
    // ����mediaĬ�ϴ��
    // @example
    //   {
    //     '/widget/**.css': {
    //       packTo: '/widget/widget_pkg.css'
    //     }
    //   }
    config.package && (function(packConfig) {
        var kv;
        if(currentMedia !== 'dev' || config.packed) {
            for(kv in packConfig) {
                fiskit.match(kv, packConfig[kv]);
            }
        }
    })(config.package);
}