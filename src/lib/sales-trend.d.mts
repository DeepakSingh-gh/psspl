export interface SalesTrendRow {period:string;salesValue:number|null;previousSalesValue:number|null;previousInvoiceCount?:number;invoiceCount?:number;productCount?:number}
export interface SalesTrendPoint {key:string;label:string;title:string;from:string;to:string;current:number|null;previous:number|null;partial:boolean}
export function salesTrendPoints(rows:SalesTrendRow[],options:{financialYear:string;periodEnd:string;today:string;grain?:'month'|'quarter'}):SalesTrendPoint[];
export function salesComparison(current:number|null,previous:number|null):{difference:number|null;growth:number|null};
export function salesAxis(points:SalesTrendPoint[]):{min:number;max:number;ticks:number[]};
export function salesMoney(value:number|null,decimals?:number):string;
export function salesLine(points:SalesTrendPoint[],field:'current'|'previous',x:(i:number)=>number,y:(value:number)=>number):string;
