// Teaching reference only: prescribed altitude profile and ISA, zero wind.
// No OpenAP fuel or performance feasibility results are inferred here.
export function referenceFlight(routeFlight,phase,mach){
 const start={cruise:35000,climb:33000,descent:37000}[phase];
 const altitude=s=>start+(35000-start)*Math.max(0,Math.min(1,(s-240)/20));
 const speed=ft=>mach*Math.sqrt(1.4*287.05287*(288.15-.0065*Math.min(ft*.3048,11000)))/.514444;
 const points=[[0,0,start]];let seconds=0;
 for(let s=1;s<=500;s++){seconds+=3600/((speed(altitude(s-1))+speed(altitude(s)))/2);points.push([seconds,s,altitude(s)]);}
 return {...routeFlight,plans:{B0:{points,mach,hitIntervals:[]}},duration:seconds,speed};
}
