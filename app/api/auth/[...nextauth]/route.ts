import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google"; // example, replace with your provider
import { authOptions } from "@/lib/authOptions"; // optional central options file
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };