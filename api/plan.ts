import { handle, type ApiRequest, type ApiResponse } from '../src/server/http.js';
export default function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  return handle('plan', req, res);
}
