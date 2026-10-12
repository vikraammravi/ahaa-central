export function validateNewPassword(password:string,confirm:string):void {
  if(password.length<12||password.length>128) throw new Error("Password must be 12–128 characters.");
  if(password!==confirm) throw new Error("Passwords don't match.");
}
