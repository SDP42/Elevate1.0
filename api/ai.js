import {secureHandler} from './_lib/http.js';
export default secureHandler(async (req,res) => {
 return res.status(410).json({error:'The event AI gateway has closed. Backend usage monitoring has stopped.'});
});
