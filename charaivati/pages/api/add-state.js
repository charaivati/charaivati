import prisma from '../../lib/prisma';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { name, shape } = req.body;

    const state = await prisma.state.create({
      data: { name, shape }
    });

    res.status(200).json(state);
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
