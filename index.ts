/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import express from 'express';
import winston from 'winston';
import type { ErrorRequestHandler } from "express";
import { type GetVerificationKey, expressjwt as jwt, type Request as JWTRequest } from "express-jwt";
import jwksRsa from "jwks-rsa";
import cors from "cors";
import cookieParser from "cookie-parser";
import actuator from "express-actuator";
import { lms, auth } from "./db";
import { Novu } from "@novu/node";

const config = {
	appId: process.env.NOVU_CLIENT_APP_ID as string,
	backendUrl: process.env.NOVU_API_ENDPOINT as string,
	socketUrl: process.env.NOVU_SOCKET_ENDPOINT as string,
};
const novu = new Novu(process.env.NOVU_API_KEY as string, config);

const app = express();
const jwksHost = process.env.PUBLIC_HANKO_API;

const logger = winston.createLogger({
  // Log only if level is less than (meaning more severe) or equal to this
  level: "info",
  defaultMeta: { service: 'user-info' },
  format: winston.format.combine(
		winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(
      (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
  ),
  // Log to the console and a file
  transports: [
    new winston.transports.Console(),
    //new winston.transports.File({ filename: "logs/app.log" }),
  ],
});

const corsOptions = {
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
};

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
	logger.error(`${err.name}: ${err.message}`);
  if (err.name === "UnauthorizedError") {
    res.sendStatus(401);
  } else {
    next(err);
  }
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(actuator());

app.use(
  jwt({
    secret: jwksRsa.expressJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 100,
      jwksUri: `${jwksHost}/.well-known/jwks.json`,
    }) as GetVerificationKey,
    algorithms: ["RS256"],
    getToken: function fromCookieOrHeader(req) {
      if (
        req.headers.authorization &&
        req.headers.authorization.split(" ")[0] === "Bearer"
      ) {
        return req.headers.authorization.split(" ")[1];
      } else if (req.cookies && req.cookies.hanko) {
        return req.cookies.hanko;
      }
      return null;
    },
  })
);

app.get("/userInfo", async (req: JWTRequest, res: express.Response) => {
  const userUUID = req.auth?.sub;
	if (userUUID) {
		logger.info(`${userUUID}`);
		const user = await lms.user.findUnique({
			where: { uuid: userUUID },
			select: {
				name: true,
				given_name: true,
				family_name: true,
				email: true,
				email_verified: true,
				gender: true,
				locale: true,
				picture: true,
				roles: true,
			},
		});

		if (!user) {
			const email = await auth.primary_emails.findUnique({
				where: { user_id: userUUID },
				select : {
					emails: {
						select: {
							created_at: true,
							updated_at: true,
							address: true,
							verified: true,
						}
					}
				}
			});
			const newUser = await lms.user.create({
				data: {
					uuid: userUUID,
					email: email?.emails.address as string,
					email_verified: email?.emails.verified,
					locale: "pt",
					roles: ["user"],
				}
			});
			logger.info(`User created: ${userUUID}`);
			const trigger = await novu.trigger('welcome-new-user', {
				to: {
					subscriberId: newUser?.id,
					email: newUser?.email,
					locale: newUser?.locale as string
				},
				payload: {}
			});
			res.status(200).send(
				JSON.stringify({
					sub: userUUID,
					email: newUser?.email,
					email_verified: newUser?.email_verified,
					locale: newUser?.locale,
					roles: newUser?.roles,
				}),
			);
		} else {
			res.status(200).send(
				JSON.stringify({
					sub: userUUID,
					name: user?.name,
					given_name: user?.given_name,
					family_name: user?.family_name,
					gender: user?.gender,
					email: user?.email,
					email_verified: user?.email_verified,
					picture: user?.picture,
					locale: user?.locale,
					roles: user?.roles,
				}),
			);
		}
	} else res.sendStatus(401);
});

app.use(errorHandler);

const server = app.listen(8002, () =>
  console.log(`
🚀 Server ready at: http://0.0.0.0:8002`),
);
