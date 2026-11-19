import songHandler from '../song';

export default async function handler(req: any, res: any) {
  return songHandler(req, res);
}
