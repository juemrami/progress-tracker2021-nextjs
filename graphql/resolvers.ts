import { prisma } from "../lib/prisma";

export const resolvers = {
    //this function looks up the dat for each feild in a query.
    //functions takes 3 up to three things (parent,argument,context)
    Query: {
      hello: async() => await prisma.user.findMany()
    
    },
};