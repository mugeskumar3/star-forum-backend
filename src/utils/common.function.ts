import { ObjectId } from "mongodb";
import { Role } from "../entity/Role.Permission";

export function hasPermission(
    role: Role,
    moduleId: string | ObjectId,
    action: "view" | "add" | "edit" | "delete"
): boolean {
    if (!role?.permissions?.length) return false;

    const moduleObjectId =
        typeof moduleId === "string" ? new ObjectId(moduleId) : moduleId;

    const permission = role.permissions.find(
        p => p.moduleId.toString() === moduleObjectId.toString()
    );

    return Boolean(permission?.actions?.[action]);
}
