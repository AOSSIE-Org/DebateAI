import { Navigate } from "react-router-dom";

interface Props {
  children: JSX.Element;
}

const AdminProtectedRoute = ({ children }: Props) => {
  const adminToken = localStorage.getItem("adminToken");
  const adminData = localStorage.getItem("adminData");

  if (!adminToken || !adminData) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

export default AdminProtectedRoute;