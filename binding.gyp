{
      'conditions': [
            [
              'OS=="mac"', {
                'variables': {
                    'arch%': '<!(uname -m)',
                }
              },
              'OS=="linux"', {
                'variables': {
                    'arch%': '<!(uname -m)',
                }
              },
              'OS=="win"', {
                'variables': {
                  'arch%': '<!(echo %PROCESSOR_ARCHITECTURE%)'
                }
              }
            ]
        ],

  'targets': [
    {
      'target_name': 'sqlserverv8',

      'variables': {
        'target%': '<!(node -e "console.log(process.versions.node)")', # Set the target variable only if it is not passed in by prebuild 
        'link_lib%': '' # set for macos based on silicon
      },

      'sources' : [  
        "<!@(node -p \"require('fs').readdirSync('./src').map(f=>'src/'+f).join(' ')\")" 
      ],

      'include_dirs': [
        "<!(node -e \"require('nan')\")",
        'src',
      ],

     'defines': [ 'NODE_GYP_V4' ],
      'actions': [
          {
            'action_name': 'print_variables',
            'action': ['echo', 'arch: <(arch) link_lib: <(link_lib)'],

            'inputs': [],
            'outputs': ['src/ConnectionHandles.cpp']
          }
      ],
      'conditions': [
            ['target < "13.0"', {
                  'defines': [
                    'PRE_V13',
                  ],
           }],
   
        [ 'OS=="win"', {
              'link_settings': {
             'libraries': [
               'odbc32'
               ],
            },
          'defines': [
            'UNICODE=1',
            'WINDOWS_BUILD',
          ],
          }
        ],
        ['OS=="linux"', {
            'link_settings': {
             'libraries': [
               '-lodbc',
               ],
            },
            'defines': [
              'LINUX_BUILD',
              'UNICODE'
            ], 
            'cflags_cc': [
              '-std=c++1y'
            ],
            'include_dirs': [
              '/usr/include/',
              '/opt/microsoft/msodbcsql17/include/',
            ],
        }],
        ['OS=="mac"', {
                'conditions': [
                ['arch == "arm64"',{
                  'variables': {
                    'link_lib%': '/opt/homebrew/lib/libodbc.a'
                  }
                }],
                ['arch == "x86_64"',{
                  'variables': {
                    'link_lib%': '-lodbc'
                  }
                }]
            ],
            'link_settings': {
             'libraries': [
               '<(link_lib)'
             #'-lodbc'
               ],
            },
            'defines': [
              'LINUX_BUILD',
              'UNICODE'
            ], 
            'cflags_cc': [
              '-std=c++1y'
            ],
            'include_dirs': [
              '/opt/homebrew/include',
              '/opt/homebrew/include/msodbcsql17'
              '/usr/local/include/',
              '/usr/local/opt/msodbcsql17/include/',
              '/usr/local/opt/msodbcsql17/include/msodbcsql17/'
            ],
        }],
      ]
    }
  ]
}
