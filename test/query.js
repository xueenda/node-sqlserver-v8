//  ---------------------------------------------------------------------------------------------------------------------------------
// File: query.js
// Contents: test suite for queries
//
// Copyright Microsoft Corporation
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
//
// You may obtain a copy of the License at:
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//  ---------------------------------------------------------------------------------------------------------------------------------

'use strict'

/* globals describe it */

const assert = require('assert')
const { TestEnv } = require('./env/test-env')
const env = new TestEnv()

describe('query', function () {
  this.timeout(30000)

  this.beforeEach(done => {
    env.open().then(() => done())
  })

  this.afterEach(done => {
    env.close().then(() => done())
  })

  it('simple query with a promise open-query-close-resolve var%', done => {
    async function exec () {
      try {
        const like = 'var%'
        const results = await env.sql.promises.query(env.connectionString, 'SELECT name FROM sys.types WHERE name LIKE ?', [like])
        for (let row = 0; row < results.first.length; ++row) {
          assert(results.first[row].name.substr(0, 3) === 'var')
        }
        return null
      } catch (err) {
        return err
      }
    }
    exec().then(res => {
      done(res)
    })
  })

  it('test retrieving a string with null embedded', testDone => {
    const embeddedNull = String.fromCharCode(65, 66, 67, 68, 0, 69, 70)

    const fns = [
      asyncDone => {
        env.theConnection.queryRaw('DROP TABLE null_in_string_test', () => {
          asyncDone()
        })
      },

      asyncDone => {
        env.theConnection.queryRaw('CREATE TABLE null_in_string_test (id int IDENTITY, null_in_string varchar(100) NOT NULL)',
          e => {
            assert.ifError(e)
            asyncDone()
          })
      },
      asyncDone => {
        env.theConnection.queryRaw('CREATE CLUSTERED INDEX ix_null_in_string_test ON null_in_string_Test (id)', err => {
          assert.ifError(err)
          asyncDone()
        })
      },
      asyncDone => {
        env.theConnection.queryRaw('INSERT INTO null_in_string_test (null_in_string) VALUES (?)', [embeddedNull],
          e => {
            assert.ifError(e)
            asyncDone()
          })
      },

      asyncDone => {
        env.theConnection.queryRaw('SELECT null_in_string FROM null_in_string_test', (e, r) => {
          assert.ifError(e)
          assert(r.rows[0][0] === embeddedNull)
          asyncDone()
        })
      }
    ]

    env.async.series(fns, () => {
      testDone()
    })
  })

  it('test retrieving a large decimal as a string', testDone => {
    const precision = 21
    const scale = 7
    const numString = '1234567891011.1213141'
    const fns = [
      asyncDone => {
        env.theConnection.queryRaw('DROP TABLE TestLargeDecimal', () => {
          asyncDone()
        })
      },
      asyncDone => {
        env.theConnection.queryRaw(`CREATE TABLE TestLargeDecimal (
          id VARCHAR(12) NOT NULL,
          testfield DECIMAL(${precision},${scale}) NOT NULL,
          PRIMARY KEY (id)
          )`,
        e => {
          assert.ifError(e)
          asyncDone()
        })
      },
      asyncDone => {
        env.theConnection.query(`INSERT INTO [dbo].[TestLargeDecimal] (id, testfield) VALUES (1, ${numString})`,
          e => {
            assert.ifError(e)
            asyncDone()
          })
      },

      asyncDone => {
        env.theConnection.query(`select id, cast(testfield as varchar(${numString.length})) as big_d_as_s from TestLargeDecimal`, (e, r) => {
          assert.ifError(e)
          assert.strictEqual(numString, r[0].big_d_as_s)
          asyncDone()
        })
      }
    ]

    env.async.series(fns, () => {
      testDone()
    })
  })

  it('multiple results from query in callback', done => {
    let moreShouldBe = true
    let called = 0
    let buffer
    let expected

    env.theConnection.queryRaw('SELECT 1 as X, \'ABC\', 0x0123456789abcdef; SELECT 2 AS Y, \'DEF\', 0xfedcba9876543210',
      function (err, results, more) {
        assert.ifError(err)
        assert.strictEqual(more, moreShouldBe)
        ++called

        if (more) {
          buffer = Buffer.from('0123456789abcdef', 'hex')
          expected = {
            meta: [{ name: 'X', size: 10, nullable: false, type: 'number', sqlType: 'int' },
              { name: '', size: 3, nullable: false, type: 'text', sqlType: 'varchar' },
              { name: '', size: 8, nullable: false, type: 'binary', sqlType: 'varbinary' }],
            rows: [[1, 'ABC', buffer]]
          }

          assert.deepStrictEqual(results, expected, 'Result 1 does not match expected')

          assert(called === 1)
          moreShouldBe = false
        } else {
          buffer = Buffer.from('fedcba9876543210', 'hex')
          expected = {
            meta: [{ name: 'Y', size: 10, nullable: false, type: 'number', sqlType: 'int' },
              { name: '', size: 3, nullable: false, type: 'text', sqlType: 'varchar' },
              { name: '', size: 8, nullable: false, type: 'binary', sqlType: 'varbinary' }],
            rows: [[2, 'DEF', buffer]]
          }

          assert.deepStrictEqual(results, expected, 'Result 2 does not match expected')
          assert(called === 2)
          done()
        }
      })
  })

  it('verify empty results retrieved properly', testDone => {
    const fns = [
      asyncDone => {
        env.theConnection.queryRaw('drop table test_sql_no_data', () => {
          asyncDone()
        })
      },
      asyncDone => {
        env.theConnection.queryRaw('create table test_sql_no_data (id int identity, name varchar(20))', err => {
          assert.ifError(err)
          asyncDone()
        })
      },
      asyncDone => {
        env.theConnection.queryRaw('create clustered index index_nodata on test_sql_no_data (id)', err => {
          assert.ifError(err)
          asyncDone()
        })
      },
      asyncDone => {
        env.theConnection.queryRaw('delete from test_sql_no_data where 1=0', (err, results) => {
          assert.ifError(err)
          const expectedResults = { meta: null, rowcount: 0 }
          assert.deepStrictEqual(results, expectedResults)
          asyncDone()
        })
      }
    ]
    env.async.series(fns, () => {
      testDone()
    })
  })

  it('object_name query ', done => {
    env.theConnection.query('select object_name(c.object_id), (select dc.definition from sys.default_constraints as dc where dc.object_id = c.default_object_id) as DefaultValueExpression from sys.columns as c', (err, results) => {
      assert.ifError(err)
      assert(results.length > 0)
      done()
    })
  })

  it('select nulls union all nulls', done => {
    const nullObj = {
      testdate: null,
      testint: null,
      testchar: null,
      testbit: null,
      testdecimal: null,
      testbinary: null,
      testtime: null
    }
    const expected = [nullObj, nullObj, nullObj]
    env.theConnection.query('select cast(null as datetime) as testdate, cast(null as int) as testint, cast(null as varchar(max)) as testchar, cast(null as bit) as testbit, cast(null as decimal) as testdecimal, cast(null as varbinary) as testbinary, cast(null as time) as testtime\n' +
      'union all\n' +
      'select cast(null as datetime) as testdate, cast(null as int) as testint, cast(null as varchar(max)) as testchar, cast(null as bit) as testbit, cast(null as decimal) as testdecimal, cast(null as varbinary) as testbinary, cast(null as time) as testtime\n' +
      'union all\n' +
      'select cast(null as datetime) as testdate, cast(null as int) as testint, cast(null as varchar(max)) as testchar, cast(null as bit) as testbit, cast(null as decimal) as testdecimal, cast(null as varbinary) as testbinary, cast(null as time) as testtime', (err, results) => {
      assert.ifError(err)
      assert(results.length === 3)
      assert.deepStrictEqual(results, expected)
      done()
    })
  })

  it('test function parameter validation', testDone => {
    // test the module level open, query and queryRaw functions
    let thrown
    const fns =
      [
        asyncDone => {
          thrown = false
          try {
            env.sql.query(env.connectionString, () => {
              return 5
            })
          } catch (e) {
            thrown = true
            assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid query string passed to function query. Type should be string.', 'Improper error returned')
          }
          assert(thrown === true)
          asyncDone()
        },

        asyncDone => {
          thrown = false
          try {
            env.sql.queryRaw(env.connectionString, ['This', 'is', 'a', 'test'])
          } catch (e) {
            thrown = true
            assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid query string passed to function queryRaw. Type should be string.', 'Improper error returned')
          }
          assert(thrown === true)
          asyncDone()
        },

        asyncDone => {
          thrown = false
          try {
            env.sql.queryRaw(['This', 'is', 'a', 'test'], 'SELECT 1')
          } catch (e) {
            thrown = true
            assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid connection string passed to function queryRaw. Type should be string.', 'Improper error returned')
          }
          assert(thrown === true)
          asyncDone()
        },

        asyncDone => {
          thrown = false
          // test the module level open, query and queryRaw functions
          try {
            env.sql.open(env.connectionString, 5)
          } catch (e) {
            thrown = true
            assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid callback passed to function open. Type should be function.', 'Improper error returned')
          }
          assert(thrown = true)
          asyncDone()
        },

        asyncDone => {
          let thrown = false
          try {
            env.sql.open(1, 'SELECT 1')
          } catch (e) {
            thrown = true
            assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid connection string passed to function open. Type should be string.', 'Improper error returned')
          }
          assert(thrown === true)
          asyncDone()
        },

        asyncDone => {
          thrown = false
          try {
            env.sql.query(() => {
              return 1
            }, 'SELECT 1')
          } catch (e) {
            thrown = true
            assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid connection string passed to function query. Type should be string.', 'Improper error returned')
          }
          assert(thrown = true)
          asyncDone()
        },

        asyncDone => {
          env.sql.queryRaw(env.connectionString, 'SELECT 1', e => {
            assert.ifError(e)
            asyncDone()
          })
        },

        asyncDone => {
          env.sql.queryRaw(env.connectionString, 'SELECT 1', [], e => {
            assert.ifError(e)
            asyncDone()
          })
        },

        asyncDone => {
          env.sql.queryRaw(env.connectionString, 'SELECT 1', null, e => {
            assert.ifError(e)
            asyncDone()
          })
        },

        asyncDone => {
          const stmt = env.sql.queryRaw(env.connectionString, 'SELECT 1', [])
          stmt.on('error', e => {
            assert.ifError(e)
          })
          stmt.on('closed', () => {
            asyncDone()
          })
        },

        asyncDone => {
          const stmt = env.sql.queryRaw(env.connectionString, 'SELECT 1', null)
          stmt.on('error', e => {
            assert.ifError(e)
          })
          stmt.on('closed', () => {
            asyncDone()
          })
        },

        asyncDone => {
          let thrown = false
          try {
            env.sql.queryRaw(env.connectionString, 'SELECT 1', 1)
          } catch (e) {
            thrown = true
            assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid parameter(s) passed to function query or queryRaw.', 'Improper error returned')
          }
          assert(thrown === true)
          asyncDone()
        },

        asyncDone => {
          let thrown = false
          try {
            env.sql.queryRaw(env.connectionString, 'SELECT 1', { a: 1, b: '2' }, () => {
            })
          } catch (e) {
            thrown = true
            assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid parameter(s) passed to function query or queryRaw.', 'Improper error returned')
          }
          assert(thrown === true)
          asyncDone()
        },

        asyncDone => {
          let thrown = false
          try {
            env.theConnection.query(1)
          } catch (e) {
            thrown = true
            assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid query string passed to function query. Type should be string.', 'Improper error returned')
          }
          assert(thrown === true)
          asyncDone()
        },

        asyncDone => {
          let thrown = false
          try {
            env.theConnection.queryRaw(() => {
              return 1
            })
          } catch (e) {
            thrown = true
            assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid query string passed to function queryRaw. Type should be string.', 'Improper error returned')
          }
          assert(thrown === true)
          asyncDone()
        }
      ]

    env.async.series(fns, () => {
      testDone()
    })
  })

  it('test retrieving a LOB string larger than max string size', testDone => {
    const stmt = env.theConnection.query('SELECT REPLICATE(CAST(\'B\' AS varchar(max)), 20000) AS \'LOB String\'')
    let len = 0
    stmt.on('column', (c, d) => {
      assert(c === 0)
      if (d) {
        len = d.length
      }
    })
    stmt.on('done', () => {
      assert(len === 20000)
      testDone()
    })
    stmt.on('error', e => {
      assert.ifError(e)
    })
  })

  it('query with errors', done => {
    const expectedError = new Error('[Microsoft][' + env.driver + '][SQL Server]Unclosed quotation mark after the character string \'m with NOBODY\'.')
    expectedError.sqlstate = '42000'
    expectedError.code = 105
    expectedError.severity = 15
    expectedError.procName = ''
    expectedError.lineNumber = 1
    const fns = [
      asyncDone => {
        assert.doesNotThrow(() => {
          env.theConnection.queryRaw('I\'m with NOBODY', e => {
            assert(e instanceof Error)
            assert(e.serverName.length > 0)
            delete e.serverName
            assert(e.message.includes('Unclosed quotation mark after the character'))
            asyncDone()
          })
        })
      },

      asyncDone => {
        assert.doesNotThrow(() => {
          const s = env.theConnection.queryRaw('I\'m with NOBODY')
          s.on('error', e => {
            assert(e instanceof Error)
            assert(e.serverName.length > 0)
            delete e.serverName
            assert(e.message.includes('Unclosed quotation mark after the character'))
            asyncDone()
          })
        })
      }
    ]

    env.async.series(fns, () => {
      done()
    })
  })

  it('simple query', done => {
    env.theConnection.query('SELECT 1 as X, \'ABC\', 0x0123456789abcdef ', (err, results) => {
      assert.ifError(err)
      const buffer = Buffer.from('0123456789abcdef', 'hex')
      const expected = [{ X: 1, Column1: 'ABC', Column2: buffer }]
      assert.deepStrictEqual(results, expected, 'Results don\'t match')
      done()
    })
  })

  it('simple rawFormat query', done => {
    env.theConnection.queryRaw('SELECT 1 as X, \'ABC\', 0x0123456789abcdef ', (err, results) => {
      assert.ifError(err)
      const buffer = Buffer.from('0123456789abcdef', 'hex')
      const expected = {
        meta: [{ name: 'X', size: 10, nullable: false, type: 'number', sqlType: 'int' },
          { name: '', size: 3, nullable: false, type: 'text', sqlType: 'varchar' },
          { name: '', size: 8, nullable: false, type: 'binary', sqlType: 'varbinary' }],
        rows: [[1, 'ABC', buffer]]
      }
      assert.deepStrictEqual(results, expected, 'rawFormat results didn\'t match')
      done()
    })
  })

  it('simple query of types like var%', done => {
    const like = 'var%'
    env.theConnection.query('SELECT name FROM sys.types WHERE name LIKE ?', [like], (err, results) => {
      assert.ifError(err)
      for (let row = 0; row < results.length; ++row) {
        assert(results[row].name.substr(0, 3) === 'var')
      }
      done()
    })
  })

  it('streaming test', done => {
    const like = 'var%'
    let currentRow = 0
    const metaExpected = [{ name: 'name', size: 128, nullable: false, type: 'text', sqlType: 'nvarchar' }]

    const stmt = env.theConnection.query('select name FROM sys.types WHERE name LIKE ?', [like])

    stmt.on('meta', meta => {
      assert.deepStrictEqual(meta, metaExpected)
    })
    stmt.on('row', idx => {
      assert(idx === currentRow)
      ++currentRow
    })
    stmt.on('column', (idx, data) => {
      assert(data.substr(0, 3) === 'var')
    })
    stmt.on('done', () => {
      done()
    })
    stmt.on('error', err => {
      assert.ifError(err)
    })
  })

  it('serialized queries', done => {
    const expected = [
      {
        meta: [{ name: '', size: 10, nullable: false, type: 'number', sqlType: 'int' }],
        rows: [[1]]
      },
      {
        meta: [{ name: '', size: 10, nullable: false, type: 'number', sqlType: 'int' }],
        rows: [[2]]
      },
      {
        meta: [{ name: '', size: 10, nullable: false, type: 'number', sqlType: 'int' }],
        rows: [[3]]
      },
      {
        meta: [{ name: '', size: 10, nullable: false, type: 'number', sqlType: 'int' }],
        rows: [[4]]
      },
      {
        meta: [{ name: '', size: 10, nullable: false, type: 'number', sqlType: 'int' }],
        rows: [[5]]
      }
    ]

    const results = []

    env.theConnection.queryRaw('SELECT 1', (e, r) => {
      assert.ifError(e)
      results.push(r)
    })

    env.theConnection.queryRaw('SELECT 2', (e, r) => {
      assert.ifError(e)
      results.push(r)
    })

    env.theConnection.queryRaw('SELECT 3', (e, r) => {
      assert.ifError(e)
      results.push(r)
    })

    env.theConnection.queryRaw('SELECT 4', (e, r) => {
      assert.ifError(e)
      results.push(r)
    })

    env.theConnection.queryRaw('SELECT 5', (e, r) => {
      assert.ifError(e)
      results.push(r)
      assert.deepStrictEqual(expected, results)
      done()
    })
  })

  it('multiple results from query in events', done => {
    const r = env.theConnection.queryRaw('SELECT 1 as X, \'ABC\', 0x0123456789abcdef; SELECT 2 AS Y, \'DEF\', 0xfedcba9876543210')

    const expected = [
      [{ name: 'X', size: 10, nullable: false, type: 'number', sqlType: 'int' },
        { name: '', size: 3, nullable: false, type: 'text', sqlType: 'varchar' },
        { name: '', size: 8, nullable: false, type: 'binary', sqlType: 'varbinary' }],
      { row: 0 },
      { column: 0, data: 1, more: false },
      { column: 1, data: 'ABC', more: false },
      {
        column: 2,
        data: Buffer.from('0123456789abcdef', 'hex'),
        more: false
      },
      [
        { name: 'Y', size: 10, nullable: false, type: 'number', sqlType: 'int' },
        { name: '', size: 3, nullable: false, type: 'text', sqlType: 'varchar' },
        { name: '', size: 8, nullable: false, type: 'binary', sqlType: 'varbinary' }
      ],
      { row: 1 },
      { column: 0, data: 2, more: false },
      { column: 1, data: 'DEF', more: false },
      {
        column: 2,
        data: Buffer.from('fedcba9876543210', 'hex'),
        more: false
      }
    ]
    const received = []

    r.on('meta', m => {
      received.push(m)
    })
    r.on('row', idx => {
      received.push({ row: idx })
    })
    r.on('column', (idx, data, more) => {
      received.push({ column: idx, data: data, more: more })
    })
    r.on('done', () => {
      assert.deepStrictEqual(received, expected)
      done()
    })
    r.on('error', e => {
      assert.ifError(e)
    })
  })

  it('boolean return value from query', done => {
    env.theConnection.queryRaw('SELECT CONVERT(bit, 1) AS bit_true, CONVERT(bit, 0) AS bit_false',
      (err, results) => {
        assert.ifError(err)
        const expected = {
          meta: [{ name: 'bit_true', size: 1, nullable: true, type: 'boolean', sqlType: 'bit' },
            { name: 'bit_false', size: 1, nullable: true, type: 'boolean', sqlType: 'bit' }],
          rows: [[true, false]]
        }
        assert.deepStrictEqual(results, expected, 'Results didn\'t match')
        done()
      })
  })

  it('test retrieving a non-LOB string of max size', testDone => {
    function repeat (c, num) {
      return new Array(num + 1).join(c)
    }

    env.theConnection.query('SELECT REPLICATE(\'A\', 8000) AS \'NONLOB String\'', (e, r) => {
      assert.ifError(e)
      assert(r[0]['NONLOB String'] === repeat('A', 8000))
      testDone()
    })
  })

  it('test retrieving an empty string', testDone => {
    env.theConnection.query('SELECT \'\' AS \'Empty String\'', (e, r) => {
      assert.ifError(e)
      assert(r[0]['Empty String'] === '')
      testDone()
    })
  })

  /*
  it('test login failure', done => {
    // construct a connection string that will fail due to
    // the database not existing
    var badConnection = env.connectionString.replace('Database={' + database + '}', 'Database={DNE}')

    env.sql.query(badConnection, 'SELECT 1 as X', err => {
      // verify we get the expected error when the login fails
      assert.ok(err.message.indexOf('Login failed for user') > 0)
      assert.equal(err.sqlstate, 28000)
      done()
    })
  })
  */

  it('test function parameter validation', testDone => {
    let thrown = false

    const fns = [
      asyncDone => {
        // test the module level open, query and queryRaw functions
        try {
          env.sql.open(1, 'SELECT 1')
        } catch (e) {
          thrown = true
          assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid connection string passed to function open. Type should be string.', 'Improper error returned')
        }
        assert(thrown === true)
        asyncDone()
      },

      asyncDone => {
        thrown = false
        try {
          env.sql.query(() => {
            return 1
          }, 'SELECT 1')
        } catch (e) {
          thrown = true
          assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid connection string passed to function query. Type should be string.', 'Improper error returned')
        }
        assert(thrown = true)
        asyncDone()
      },

      asyncDone => {
        thrown = false
        try {
          env.sql.queryRaw(['This', 'is', 'a', 'test'], 'SELECT 1')
        } catch (e) {
          thrown = true
          assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid connection string passed to function queryRaw. Type should be string.', 'Improper error returned')
        }
        assert(thrown === true)
        asyncDone()
      },

      asyncDone => {
        thrown = false
        // test the module level open, query and queryRaw functions
        try {
          env.sql.open(env.connectionString, 5)
        } catch (e) {
          thrown = true
          assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid callback passed to function open. Type should be function.', 'Improper error returned')
        }
        assert(thrown = true)
        asyncDone()
      },

      asyncDone => {
        thrown = false
        try {
          env.sql.query(env.connectionString, () => {
            return 5
          })
        } catch (e) {
          thrown = true
          assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid query string passed to function query. Type should be string.', 'Improper error returned')
        }
        assert(thrown === true)
        asyncDone()
      },

      asyncDone => {
        thrown = false
        try {
          env.sql.queryRaw(env.connectionString, ['This', 'is', 'a', 'test'])
        } catch (e) {
          thrown = true
          assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid query string passed to function queryRaw. Type should be string.', 'Improper error returned')
        }
        assert(thrown === true)
        asyncDone()
      },

      asyncDone => {
        const stmt = env.sql.queryRaw(env.connectionString, 'SELECT 1')
        stmt.on('error', e => {
          assert.ifError(e)
        })
        stmt.on('closed', () => {
          asyncDone()
        })
      },

      asyncDone => {
        env.sql.queryRaw(env.connectionString, 'SELECT 1', e => {
          assert.ifError(e)
          asyncDone()
        })
      },

      asyncDone => {
        env.sql.queryRaw(env.connectionString, 'SELECT 1', [], e => {
          assert.ifError(e)
          asyncDone()
        })
      },

      asyncDone => {
        env.sql.queryRaw(env.connectionString, 'SELECT 1', null, e => {
          assert.ifError(e)
          asyncDone()
        })
      },

      asyncDone => {
        const stmt = env.sql.queryRaw(env.connectionString, 'SELECT 1', [])
        stmt.on('error', e => {
          assert.ifError(e)
        })
        stmt.on('closed', () => {
          asyncDone()
        })
      },

      asyncDone => {
        const stmt = env.sql.queryRaw(env.connectionString, 'SELECT 1', null)
        stmt.on('error', e => {
          assert.ifError(e)
        })
        stmt.on('closed', () => {
          asyncDone()
        })
      },

      asyncDone => {
        thrown = false
        try {
          env.sql.queryRaw(env.connectionString, 'SELECT 1', 1)
        } catch (e) {
          thrown = true
          assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid parameter(s) passed to function query or queryRaw.', 'Improper error returned')
        }
        assert(thrown === true)
        asyncDone()
      },

      asyncDone => {
        thrown = false
        try {
          env.sql.queryRaw(env.connectionString, 'SELECT 1', { a: 1, b: '2' }, () => {
          })
        } catch (e) {
          thrown = true
          assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid parameter(s) passed to function query or queryRaw.', 'Improper error returned')
        }
        assert(thrown === true)
        asyncDone()
      },

      asyncDone => {
        thrown = false
        try {
          env.theConnection.query(1)
        } catch (e) {
          thrown = true
          assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid query string passed to function query. Type should be string.', 'Improper error returned')
        }
        assert(thrown === true)
        asyncDone()
      },

      asyncDone => {
        thrown = false
        try {
          env.theConnection.queryRaw(() => {
            return 1
          })
        } catch (e) {
          thrown = true
          assert.strictEqual(e.toString(), 'Error: [msnodesql] Invalid query string passed to function queryRaw. Type should be string.', 'Improper error returned')
          asyncDone()
        }
        assert(thrown === true)
      }
    ]

    env.async.series(fns, () => {
      testDone()
    })
  })

  it('verify metadata is retrieved for udt/geography types', testDone => {
    const fns = [

      asyncDone => {
        env.theConnection.query('DROP TABLE spatial_test', () => {
          asyncDone()
        })
      },
      asyncDone => {
        env.theConnection.query('CREATE TABLE spatial_test ( id int IDENTITY (1,1), GeogCol1 geography, GeogCol2 AS GeogCol1.STAsText() )', e => {
          assert.ifError(e)
          asyncDone()
        })
      },
      asyncDone => {
        env.theConnection.query('INSERT INTO spatial_test (GeogCol1) VALUES (geography::STGeomFromText(\'LINESTRING(-122.360 47.656, -122.343 47.656 )\', 4326))',
          e => {
            assert.ifError(e)
            asyncDone()
          })
      },
      asyncDone => {
        env.theConnection.query('INSERT INTO spatial_test (GeogCol1) VALUES (geography::STGeomFromText(\'POLYGON((-122.358 47.653 , -122.348 47.649, -122.348 47.658, -122.358 47.658, -122.358 47.653))\', 4326))', e => {
          assert.ifError(e)
          asyncDone()
        })
      },
      asyncDone => {
        env.theConnection.queryRaw('SELECT GeogCol1 FROM spatial_test', (e, r) => {
          assert.ifError(e)
          const expectedResults = {
            meta: [{
              name: 'GeogCol1',
              size: 0,
              nullable: true,
              type: 'binary',
              sqlType: 'udt',
              udtType: 'geography'
            }],
            rows: [[Buffer.from('e610000001148716d9cef7d34740d7a3703d0a975ec08716d9cef7d34740cba145b6f3955ec0', 'hex')],
              [Buffer.from('e6100000010405000000dd24068195d34740f4fdd478e9965ec0508d976e12d3474083c0caa145965ec04e62105839d4474083c0caa145965ec04e62105839d44740f4fdd478e9965ec0dd24068195d34740f4fdd478e9965ec001000000020000000001000000ffffffff0000000003', 'hex')]
            ]
          }
          assert.deepStrictEqual(r, expectedResults, 'udt results don\'t match')
          asyncDone()
        })
      }
    ]
    env.async.series(fns, () => {
      testDone()
    })
  })
})
