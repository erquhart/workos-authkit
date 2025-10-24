import "./App.css";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "@workos-inc/authkit-react";

function App() {
  const user = useQuery(api.example.getCurrentUser);
  const count = useQuery(api.example.count, { name: "accomplishments" });
  const addOne = useMutation(api.example.addOne);
  const { signIn, signOut, user: authKitUser } = useAuth();
  console.log("authKitUser", authKitUser);

  return (
    <>
      <h1>WorkOS AuthKit Example</h1>
      <button onClick={() => (user ? signOut() : void signIn())}>
        {user ? "Sign out" : "Sign in"}
      </button>
      <p>User: {user?.email}</p>
      <div className="card">
        <button onClick={() => addOne()}>count is {count}</button>
        <p>
          See <code>example/convex/example.ts</code> for all the ways to use
          this component
        </p>
      </div>
    </>
  );
}

export default App;
