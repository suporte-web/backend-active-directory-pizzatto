export class CreateUserAdDto {
  username: string; // sAMAccountName
  password: string;
  firstName: string;
  lastName: string;
  email?: string;
  ouPath: string;
}
