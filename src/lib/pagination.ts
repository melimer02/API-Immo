/** Calcule skip/take pour Prisma et les métadonnées renvoyées au client */
export function pagination(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}

export function meta(page: number, limit: number, total: number) {
  return { page, limit, total, pages: Math.ceil(total / limit) };
}
