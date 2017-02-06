/**
 * Created by admin on 19/01/2017.
 */

import {MsNodeSqlWrapperModule} from './lib/MsNodeSqWrapperModule'
import v8Meta = MsNodeSqlDriverApiModule.v8Meta;
import {MsNodeSqlDriverApiModule} from "./lib/MsNodeSqlDriverApiModule";
import v8RawData = MsNodeSqlDriverApiModule.v8RawData;
import CommandResponse = MsNodeSqlWrapperModule.SqlCommandResponse;
import v8driver = MsNodeSqlDriverApiModule.v8driver;

let assert = require('assert');
let supp = require('./demo-support');

class eventHits {
    public onMeta: number;
    public onColumn: number;
    public onRowCount: number;
    public onRow: number;
    public onDone: number;
    public onClosed: number;
    public onError: number;
}

class WrapperTest {

    conn_str:string;
    support:any;
    procedureHelper:any;
    helper:any;
    parsedJSON:any;
    sqlWrapper:MsNodeSqlWrapperModule.Sql;
    legacy:v8driver = MsNodeSqlWrapperModule.legacyDriver;

    constructor(public debug:boolean = false) {
    }

    public run(done:Function) {
        supp.GlobalConn.init(this.legacy, (co: any) => {
                this.conn_str = co.conn_str;
                this.sqlWrapper = new MsNodeSqlWrapperModule.Sql(this.conn_str);
                this.support = co.support;
                this.procedureHelper = new this.support.ProcedureHelper(this.conn_str);
                this.procedureHelper.setVerbose(false);
                let async = co.async;
                this.helper = co.helper;
                this.parsedJSON = this.helper.getJSON();
                if (this.debug) console.log(this.conn_str);
                this.exec(done);
            }
        );
    }

    private exec(done:Function) : void {
        this.storedProcedure().then(()=> {
            this.eventSubscribe().then(() => done()).
            catch(e=> {
                console.log(JSON.stringify(e,null,2));
            });
        }).catch(e=> {
            console.log(JSON.stringify(e,null,2));
        });
    }

    storedProcedure() : Promise<any> {

        let sp_name = "test_sp_get_int_int";

        let def = "alter PROCEDURE <name>"+
            "(\n" +
            "@num1 INT,\n" +
            "@num2 INT,\n" +
            "@num3 INT OUTPUT\n" +
            "\n)" +
            "AS\n" +
            "BEGIN\n" +
            "   SET @num3 = @num1 + @num2\n"+
            "   RETURN 99;\n"+
            "END\n";

        return new Promise((resolve, reject) => {
            this.sqlWrapper.open().then(c => {
                console.log('opened');
                let command = c.getCommand();
                let inst = this;
                this.procedureHelper.createProcedure(sp_name, def, function () {
                    command.procedure('test_sp_get_int_int').params([1, 2]).execute().then(res => {
                        let expected = [99, 3];
                        assert.deepEqual(res.outputParams, expected, "results didn't match");
                        if (inst.debug) console.log('==============================');
                        if (inst.debug) console.log(JSON.stringify(res, null, 2));
                        c.close().then(() => {
                            if (inst.debug) console.log('closed - finished.');
                            resolve();
                        });
                    }).catch((e: any) => {
                        console.log(JSON.stringify(e, null, 2));
                        reject(e);
                    });
                });
            });
        });
    }

    eventSubscribe() : Promise<any>{
        return new Promise((resolve, reject) => {
            this.sqlWrapper.open().then(c => {
                console.log('opened');
                let command = c.getCommand();
                command.sql(`select 1+1 as v, convert(DATETIME, '2017-02-06') as d`);

                let h = new eventHits();
                let expectedMeta = [
                    {
                        "size": 10,
                        "name": "v",
                        "nullable": true,
                        "type": "number",
                        "sqlType": "int"
                    },
                    {
                        "size": 23,
                        "name": "d",
                        "nullable": false,
                        "type": "date",
                        "sqlType": "datetime"
                    }
                ];
                command.onMeta((meta: v8Meta) => {
                    if (this.debug) console.log(`onMeta: ${JSON.stringify(meta, null, 2)}`);
                    h.onMeta++;
                    assert.deepEqual(expectedMeta, meta, "results didn't match");
                }).onColumn((col, data, more) => {
                    if (this.debug) console.log(`onColumn: more = ${more} data = ${JSON.stringify(data, null, 2)}`);
                    h.onColumn++;
                }).onRowCount(count => {
                    if (this.debug) console.log(`onRowCount: ${count}`);
                    h.onRowCount++;
                }).onRow(r => {
                    if (this.debug) console.log(`onRow: row = ${JSON.stringify(r, null, 2)}`);
                    h.onRow++;
                }).onDone(() => {
                    if (this.debug) console.log(`onDone:`);
                    h.onDone++;
                }).onClosed(() => {
                    if (this.debug) console.log(`onClose:`);
                    h.onClosed++;
                }).onError((e: any) => {
                    if (this.debug) console.log(`onError: e = ${JSON.stringify(e, null, 2)}`);
                    h.onError++;
                }).execute().then((res: CommandResponse) => {
                    if (this.debug) console.log('==============================');
                    if (this.debug) console.log(JSON.stringify(res, null, 2));
                    let expected = [
                        {
                            "v": 2,
                            "d": "2017-06-06T00:00:00.000Z"
                        }
                    ];
                    assert.deepEqual(res.asObjects, expected, "results didn't match");
                }).catch((e: CommandResponse) => {
                    h.onError++;
                    if (this.debug) console.log(JSON.stringify(e, null, 2));
                    reject(e);
                });
            }).catch(e => {
                console.log(e);
                reject(e);
            });
        });
    }
}

let wt = new WrapperTest(
);
wt.run(()=> {
    console.log('done.');
});



