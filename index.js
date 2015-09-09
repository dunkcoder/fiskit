// ��չfis��һЩ��������
var fiskit = module.exports = require('fis3');
fiskit.require.prefixes.unshift('fk');
fiskit.configName = 'fk-conf';
fiskit.cli.name = 'fk';
//fiskit.cli.help.commands = [ 'release', 'install', 'server', 'init' ];
fiskit.cli.info = require('./package.json');
fiskit.cli.version = require('./lib/logo');

// ��ȡĬ�������ļ�
var config = require('./lib/config');

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

// Ĭ������
fiskit
    // ���»��߿�ͷ�Ĳ�����
    .match('**/{_*,_*.*}', {
        release: false
    })
    // �ر�md5
    .match('*', {
        useHash: false
    })
    // ���������ļ���widget��vm�ļ�
    .match('{/widget/**.{mock,json,vm},/page/**.{json,mock},/page/macro.vm}', {
        release: false
    })
    // ����css sprite
    .match('*.{css,scss}', {
        sprite: true
    })
    // sass
    .match('*.scss', {
        parser: fiskit.plugin('sass'),
        rExt: '.css'
    })
    // widget���������ģ�黯
    .match('/widget/**.{css,scss,js}', {
        isMod: true
    });

// ���Զ���fis����
fiskit.amount = function(cfg) {
    // �ϲ���������
    fiskit.util.merge(config, cfg);

    // ��ȡrelease�������
    config.cdn = fiskit.get('--domain') ? true : config.cdn;
    config.packed = fiskit.get('--pack') ? true : config.packed;

    // ����ģ�黯���
    config.modules && fiskit.hook(config.modules.mode, config.modules);

    // ��̬��Դ���ز��
    fiskit.match('::packager', {
        postpackager: fiskit.plugin('loader', {
            resourceType: config.modules ? config.modules.mode : 'auto',
            useInlineMap: true
        }),
        spriter: fiskit.plugin('csssprites')
    });

    // ȫ������
    fiskit
        .match('*', {
            // ����������cdn�����ÿ���
            domain: config.cdn ? (config.cdnUrl + '/' + config.version) : ''
        })
        // ��̬��Դ��md5
        .match('*.{css,scss,js,png,jpg,gif}', {
            useHash: config.useHash
        })
        // ���velocityģ������
        .match('/page/(**.vm)', {
            parser: fiskit.plugin('velocity', config.velocity),
            rExt: '.html',
            loaderLang: 'html',
            release: '$1'
        })

    // ��������
    config.devPath && fiskit.media('dev').match('*', {
        deploy: fiskit.plugin('local-deliver', {
            to: config.devPath
        })
    });

    // ֻ����VMģ��
    (function(config) {
        var tmpVelocity = fiskit.util.merge({parse: false}, config.velocity);
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
                r.push(fis.plugin('replace', raw));
            });
            return r;
        };

        fiskit
            .media('vm')
            .match('*', {
                domain: config.cdnUrl + '/' + config.version
            })
            .match('*.vm', {
                parser: fiskit.plugin('velocity', tmpVelocity),
                rExt: '.vm',
                loaderLang: 'html',
                deploy: replacer(config.replace).concat(fis.plugin('local-deliver', {
                    to: './output/template/' + config.version
                }))
            })
            .match('/page/(**.vm)', {
                release: '$1'
            })
            .match('/widget/**.vm', {
                release: '$0'
            });
    })(config);

    // debug��prod����
    (function(config) {
        ['debug', 'prod'].forEach(function(_media) {
            fiskit
                .media(_media)
                .match('/{page/**.vm,mock/**}', {
                    release: false
                })
                .match('*', {
                    domain: config.cdnUrl + '/' + config.version,
                    deploy: fiskit.plugin('local-deliver', {
                        to: 'output/' + _media + '/' + config.version
                    })
                })
        });

        // ������������
        // ������ֱ���ϴ�CDN������
        fiskit
            .media('prod')
            .match('*.js', {
                optimizer: fiskit.plugin('uglify-js', {
                    mangle: ['require', 'define']
                })
            })
            .match('*.{css,scss}', {
                optimizer: fiskit.plugin('clean-css')
            })
            .match('*.png', {
                optimizer: fiskit.plugin('png-compressor')
            })
    })(config);

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
        var _media, kv;
        ['dev', 'vm', 'debug', 'prod'].forEach(function(media) {
            if(media !== 'dev' || config.packed) {
                _media = fiskit.media(media);
                for(kv in packConfig) {
                    _media.match(kv, packConfig[kv]);
                }
            }
        });
    })(config.package);
};