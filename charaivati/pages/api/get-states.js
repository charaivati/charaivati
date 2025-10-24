import prisma from '../../lib/prisma';

export default async function handler(req, res) {
  const states = await prisma.state.findMany();
  res.status(200).json(states);
}
