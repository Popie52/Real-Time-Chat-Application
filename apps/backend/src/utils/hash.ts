import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export const hashValue = async (value: string): Promise<string> => {
  return bcrypt.hash(value, SALT_ROUNDS);
};

export const verifyHash = async (
  value: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(value, hash);
};
