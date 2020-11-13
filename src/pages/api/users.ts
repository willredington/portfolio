import { NextApiRequest, NextApiResponse } from 'next';

export default (
  req: NextApiRequest,
  res: NextApiResponse<Record<'name', string>>,
) => {
  return res.status(200).json({ name: 'John Doe' });
};
