import {Document,Page,Text,View,StyleSheet} from "@react-pdf/renderer";
import type {InvoicePdfData} from "@/lib/invoice-pdf";

const styles=StyleSheet.create({
  page:{paddingTop:38,paddingBottom:48,paddingHorizontal:36,fontFamily:"Helvetica",fontSize:10,color:"#263238"},
  business:{fontSize:16,fontFamily:"Helvetica-Bold",marginBottom:5},contact:{fontSize:9,lineHeight:1.5,color:"#52606d"},
  header:{position:"relative",minHeight:105,marginBottom:20},company:{width:"35%"},
  title:{position:"absolute",top:0,left:"35%",width:"30%",textAlign:"center",fontSize:24,color:"#25616b"},
  draft:{position:"absolute",top:0,right:0,width:75,textAlign:"center",fontSize:9,fontFamily:"Helvetica-Bold",color:"#805b18",backgroundColor:"#fff3d6",paddingVertical:6,borderRadius:4},
  notice:{position:"absolute",top:29,right:0,width:100,textAlign:"right",fontSize:8,color:"#697780"},
  billing:{flexDirection:"row",justifyContent:"space-between",marginBottom:22,gap:24},billTo:{width:"52%"},meta:{width:"42%"},label:{fontSize:8,color:"#697780",marginBottom:5},bold:{fontFamily:"Helvetica-Bold"},
  metaRow:{flexDirection:"row",justifyContent:"space-between",marginBottom:5,gap:8},
  row:{flexDirection:"row",paddingVertical:5,borderBottomWidth:0.5,borderBottomColor:"#e5eaed",alignItems:"flex-start"},
  heading:{backgroundColor:"#e2eef0",color:"#25616b",fontSize:8,fontFamily:"Helvetica-Bold",paddingHorizontal:5},
  item:{width:"40%",paddingRight:8},qty:{width:"10%",textAlign:"right"},rate:{width:"17%",textAlign:"right"},tax:{width:"12%",textAlign:"right"},amount:{width:"21%",textAlign:"right"},
  unit:{fontSize:8,color:"#697780",marginTop:3},totals:{marginTop:18,marginLeft:"53%",paddingTop:5},total:{borderTopWidth:1,borderTopColor:"#9aadb3",paddingTop:9,fontSize:13,fontFamily:"Helvetica-Bold"},
  section:{marginTop:22,fontSize:10,fontFamily:"Helvetica-Bold",marginBottom:6},orderRow:{flexDirection:"row",justifyContent:"space-between",fontSize:9,paddingVertical:5,borderBottomWidth:0.5,borderBottomColor:"#e5eaed"},
  footer:{position:"absolute",bottom:22,left:36,right:36,textAlign:"center",fontSize:8,color:"#697780"},
});
const money=(value:number)=>new Intl.NumberFormat("en-CA",{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
function date(value:string){const [year,month,day]=value.slice(0,10).split("-").map(Number);return new Date(Date.UTC(year,month-1,day)).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"});}
export function InvoicePdfDocument({invoice}:{invoice:InvoicePdfData}){
  return <Document title={`Invoice ${invoice.number}`} author="Aaha Truly South"><Page size="LETTER" style={styles.page} wrap>
    <View style={styles.header} wrap={false}>
      <View style={styles.company}><Text style={styles.business}>Aaha Truly South</Text><Text style={styles.contact}>1177 Brimley Road{`\n`}Scarborough ON M1P 3G5{`\n`}+1 226 724 3456{`\n`}aahatrulysouth@gmail.com</Text></View>
      <Text style={styles.title}>INVOICE</Text>
      {invoice.draft&&<><Text style={styles.draft}>DRAFT</Text><Text style={styles.notice}>{invoice.period?"Not sent to branch":"Individual invoice"}</Text></>}
    </View>
    <View style={styles.billing} wrap={false}>
      <View style={styles.billTo}><Text style={styles.label}>BILL TO</Text><Text style={styles.bold}>{invoice.branch.name}</Text>{invoice.branch.address&&<Text style={styles.contact}>{invoice.branch.address}</Text>}</View>
      <View style={styles.meta}><View style={styles.metaRow}><Text>Invoice</Text><Text style={styles.bold}>{invoice.number}</Text></View><View style={styles.metaRow}><Text>Date</Text><Text>{date(invoice.date)}</Text></View>
        {invoice.period&&<><View style={styles.metaRow}><Text>From</Text><Text>{date(invoice.period.from)}</Text></View><View style={styles.metaRow}><Text>To</Text><Text>{date(invoice.period.to)}</Text></View></>}
        {invoice.payment&&<View style={styles.metaRow}><Text>Payment</Text><Text>{invoice.paymentNeedsReview?"Needs review":invoice.payment==="PAID"?"Paid":"Unpaid"}</Text></View>}
      </View>
    </View>
    <View style={[styles.row,styles.heading]} fixed><Text style={styles.item}>ITEM / UNIT</Text><Text style={styles.qty}>QTY</Text><Text style={styles.rate}>RATE (CA$)</Text><Text style={styles.tax}>TAX</Text><Text style={styles.amount}>AMOUNT (CA$)</Text></View>
    {invoice.lines.map((line,index)=><View style={styles.row} key={index} wrap={false} minPresenceAhead={index===invoice.lines.length-1?110:0}><View style={styles.item}><Text>{line.name}{line.unit&&<Text style={styles.unit}> · {line.unit}</Text>}</Text></View><Text style={styles.qty}>{line.quantity}</Text><Text style={styles.rate}>{money(line.price)}</Text><Text style={styles.tax}>{line.taxable?"13%":"N/A"}</Text><Text style={styles.amount}>{money(line.subtotal)}</Text></View>)}
    <View style={styles.totals} wrap={false}><View style={styles.metaRow}><Text>Subtotal</Text><Text>CA${money(invoice.subtotal)}</Text></View><View style={styles.metaRow}><Text>Tax</Text><Text>CA${money(invoice.tax)}</Text></View><View style={[styles.metaRow,styles.total]}><Text>Total</Text><Text>CA${money(invoice.total)}</Text></View>
      {invoice.payment&&!invoice.paymentNeedsReview&&<View style={styles.metaRow}><Text>Balance due</Text><Text>CA${money(invoice.payment==="PAID"?0:invoice.total)}</Text></View>}
    </View>
    {!!invoice.orders?.length&&<><Text style={styles.section} minPresenceAhead={35}>Included orders ({invoice.orders.length})</Text>{invoice.orders.map(order=><View key={order.number} style={styles.orderRow} wrap={false}><Text>Order #{order.number}</Text><Text>{date(order.date)}</Text><Text>CA${money(order.total)}</Text></View>)}</>}
    <Text style={styles.footer} fixed render={({pageNumber,totalPages})=>`${invoice.number}  |  All amounts in Canadian dollars  |  Page ${pageNumber} of ${totalPages}`}/>
  </Page></Document>;
}
