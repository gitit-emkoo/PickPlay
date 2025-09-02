// A/B Test utility file
export function pickSlot(uid = '') { 
  let sum = 0; 
  for (let i = 0; i < uid.length; i++) sum += uid.charCodeAt(i); 
  return sum % 2 === 0 ? 'A' : 'B'; 
}
