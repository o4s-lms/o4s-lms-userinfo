// import { PrismaClient } from "@prisma/client";
// import type Prisma from "prisma";

import { PrismaClient as Lms } from "./node_modules/@prisma/client/lms";
import { PrismaClient as Auth } from "./node_modules/@prisma/client/auth";

const globalForLms = globalThis as { lms?: Lms };
const globalForAuth = globalThis as { auth?: Auth };

/**export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });*/

export const lms =
	globalForLms.lms ||
	new Lms({
		log:
			process.env.NODE_ENV === "development"
				? ["query", "error", "warn"]
				: ["error"],
		datasources: {
			db: {
				url: process.env.DATABASE_LMS_DEV,
			},
		},
  });

export const auth =
	globalForAuth.auth ||
	new Auth({
		log:
			process.env.NODE_ENV === "development"
				? ["query", "error", "warn"]
				: ["error"],
		datasources: {
			db: {
				url: process.env.DATABASE_AUTH_DEV,
			},
		},
	});

//if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
if (process.env.NODE_ENV !== "production") globalForLms.lms = lms;
if (process.env.NODE_ENV !== "production") globalForAuth.auth = auth;
