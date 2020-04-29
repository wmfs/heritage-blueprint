/* eslint-env mocha */

'use strict'

const chai = require('chai')
const expect = chai.expect
const path = require('path')
const tymly = require('@wmfs/tymly')
const process = require('process')

describe('Heritage tests', function () {
  this.timeout(process.env.TIMEOUT || 5000)

  const STATE_MACHINE_NAME = 'wmfs_refreshFromCsvFile_1_0'

  let tymlyService
  let statebox
  let client

  before(function () {
    if (process.env.PG_CONNECTION_STRING && !/^postgres:\/\/[^:]+:[^@]+@(?:localhost|127\.0\.0\.1).*$/.test(process.env.PG_CONNECTION_STRING)) {
      console.log(`Skipping tests due to unsafe PG_CONNECTION_STRING value (${process.env.PG_CONNECTION_STRING})`)
      this.skip()
    }
  })

  it('startup tymly', async () => {
    const tymlyServices = await tymly.boot(
      {
        pluginPaths: [
          require.resolve('@wmfs/tymly-pg-plugin'),
          path.resolve(__dirname, '../node_modules/@wmfs/tymly-test-helpers/plugins/allow-everything-rbac-plugin')
        ],
        blueprintPaths: [
          path.resolve(__dirname, './../')
        ],
        config: {}
      }
    )

    tymlyService = tymlyServices.tymly
    statebox = tymlyServices.statebox
    client = tymlyServices.storage.client
  })

  it('execute importingCsvFiles', async () => {
    const executionDescription = await statebox.startExecution(
      {
        sourceDir: path.resolve(__dirname, './fixtures/input')
      },
      STATE_MACHINE_NAME,
      {
        sendResponse: 'COMPLETE'
      }
    )

    expect(executionDescription.status).to.eql('SUCCEEDED')
    expect(executionDescription.currentStateName).to.equal('ImportingCsvFiles')
  })

  it('verify data in the table', async () => {
    const result = await client.query(
      'select uprn, address, info from wmfs.heritage order by uprn;'
    )

    expect(result.rowCount).to.eql(13)
    expect(result.rows[0].uprn).to.eql('1234567890')
    expect(result.rows[4].uprn).to.eql('1234567894')
    expect(result.rows[10].uprn).to.eql('12345678910')
  })

  it('clean up the table', async () => {
    const result = await client.query(
      'DELETE FROM wmfs.heritage WHERE uprn::text LIKE \'123456789%\';'
    )

    expect(result.rowCount).to.eql(13)
  })

  it('verify empty table', async () => {
    const result = await client.query(
      'select * from wmfs.heritage;'
    )

    expect(result.rows).to.eql([])
  })

  after('should shutdown Tymly', async () => {
    await tymlyService.shutdown()
  })
})
