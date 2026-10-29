import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('chart API metadata distinguishes verified net zero from no prior invoices without changing amounts',async()=>{
 const temp=mkdtempSync(join(tmpdir(),'psspl-sales-trend-api-'));process.env.NODE_ENV='test';process.env.CRM_TEST_DATABASE_ROOT=temp;process.env.CRM_DATABASE_PATH=join(temp,'fixture.sqlite');process.env.CRM_DISABLE_BASELINE_RESTORE='true';
 const {db}=await import('../server/db.mjs');
 try{
  for(const [id,date,amount,type] of [['current-apr','2024-04-05',100,'Sales'],['current-may','2024-05-05',50,'Sales'],['previous-sale','2023-04-05',100,'Sales'],['previous-return','2023-04-06',100,'Credit Note']]){
   db.prepare('INSERT INTO tally_invoices(id,company_name,voucher_type,invoice_date,customer_name,amount) VALUES(?,?,?,?,?,?)').run(id,'Isolated fixture',type,date,'Isolated customer',amount);
   db.prepare('INSERT INTO tally_invoice_lines(id,invoice_id,product_name,quantity,amount) VALUES(?,?,?,?,?)').run('line-'+id,id,'Isolated product',1,amount);
  }
  const {adminRouter}=await import('../server/admin.mjs');const handler=adminRouter.stack.find(layer=>layer.route?.path==='/product-trends').route.stack[0].handle;let data;
  handler({query:{fy:'2024-25'}},{json:value=>{data=value;}},error=>{throw error;});
  assert.equal(data.summary.totalSales,150);assert.equal(data.summary.previousTotalSales,0);assert.equal(data.monthlyTrend[0].salesValue,100);assert.equal(data.monthlyTrend[0].previousSalesValue,0);assert.equal(data.monthlyTrend[0].previousInvoiceCount,2);assert.equal(data.monthlyTrend[1].salesValue,50);assert.equal(data.monthlyTrend[1].previousSalesValue,0);assert.equal(data.monthlyTrend[1].previousInvoiceCount,0);
 }finally{db.close();rmSync(temp,{recursive:true,force:true});}
});
