import "./App.css";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "@workos-inc/authkit-react";

function App() {
  const { signIn, signOut } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(
    api.example.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  return (
    <>
      <h1>WorkOS AuthKit Example</h1>
      <button onClick={() => (isAuthenticated ? signOut() : void signIn())}>
        {isAuthenticated ? "Sign out" : "Sign in"}
      </button>
      <p>User: {user?.email}</p>
    </>
  );
}

export default App;
