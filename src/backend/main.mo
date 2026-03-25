import Map "mo:core/Map";
import List "mo:core/List";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";
import Principal "mo:core/Principal";
import Float "mo:core/Float";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Order "mo:core/Order";
import Int "mo:core/Int";
import Nat32 "mo:core/Nat32";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  // Types
  type ProjectId = Nat;
  type Meters = Float;

  type Project = {
    name : Text;
    coordinates : [(Float, Float)];
    area : Meters;
    perimeter : Meters;
  };

  module Project {
    public func compare(project1 : Project, project2 : Project) : Order.Order {
      switch (Text.compare(project1.name, project2.name)) {
        case (#equal) { Nat.compare(project1.coordinates.size(), project2.coordinates.size()) };
        case (order) { order };
      };
    };
  };

  type ProjectInternal = {
    project : Project;
    creationTime : Time.Time;
  };

  module ProjectInternal {
    public func compare(projectInternal1 : ProjectInternal, projectInternal2 : ProjectInternal) : Order.Order {
      switch (Project.compare(projectInternal1.project, projectInternal2.project)) {
        case (#equal) { Int.compare( projectInternal1.creationTime, projectInternal2.creationTime ) };
        case (order) { order };
      };
    };

    public func compareByCreationTimeDescending(projectInternal1 : ProjectInternal, projectInternal2 : ProjectInternal) : Order.Order {
      Int.compare(projectInternal2.creationTime, projectInternal1.creationTime);
    };
  };

  public type UserProfile = {
    name : Text;
  };

  //-------------------------------------------------
  // Custom Data
  //-------------------------------------------------
  // Map of projects per user
  let userProjects = Map.empty<Principal, Map.Map<ProjectId, ProjectInternal>>();
  var nextProjectId = 0;

  // User profiles
  let userProfiles = Map.empty<Principal, UserProfile>();

  // Mixin for task management
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  //-------------------------------------------------
  // User Profile Functions
  //-------------------------------------------------
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  //-------------------------------------------------
  // Getter Functions
  //-------------------------------------------------
  /// Get all project IDs for the caller
  public query ({ caller }) func getProjectIds() : async [ProjectId] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access projects");
    };
    switch (userProjects.get(caller)) {
      case (null) { [] };
      case (?projects) { projects.keys().toArray().sort() };
    };
  };

  /// Get all projects for the caller
  public query ({ caller }) func getProjects() : async [Project] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access projects");
    };
    switch (userProjects.get(caller)) {
      case (null) { [] };
      case (?projects) {
        let projectEntries = List.empty<(ProjectId, ProjectInternal)>();
        for (entry in projects.entries()) {
          projectEntries.add(entry);
        };
        projectEntries.toArray().map<(ProjectId, ProjectInternal), ProjectInternal>(func(tuple) { tuple.1 }).sort().map(func(internal) { internal.project });
      };
    };
  };

  /// Get a specific project by ID
  public query ({ caller }) func getProject(projectId : ProjectId) : async Project {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access projects");
    };
    switch (userProjects.get(caller)) {
      case (null) { Runtime.trap("Project not found.") };
      case (?projects) {
        switch (projects.get(projectId)) {
          case (null) { Runtime.trap("Project not found.") };
          case (?projectInternal) { projectInternal.project };
        };
      };
    };
  };

  /// Get all project IDs for the caller, sorted by creation time (most recent first)
  public query ({ caller }) func getProjectIdsByCreationTime() : async [ProjectId] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access projects");
    };
    switch (userProjects.get(caller)) {
      case (null) { [] };
      case (?projects) {
        let projectEntries = List.empty<(ProjectId, ProjectInternal)>();
        for (entry in projects.entries()) {
          projectEntries.add(entry);
        };
        projectEntries.toArray().sort(
          func(a, b) { ProjectInternal.compareByCreationTimeDescending(a.1, b.1) }
        ).map<(ProjectId, ProjectInternal), ProjectId>(func(tuple) { tuple.0 });
      };
    };
  };

  /// Get projects for the caller, filtered by a search term in the name (case-insensitive).
  public query ({ caller }) func searchProjects(term : Text) : async [Project] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access projects");
    };
    let lowerTerm = term.toLower();
    switch (userProjects.get(caller)) {
      case (null) { [] };
      case (?projects) {
        let projectEntries = List.empty<(ProjectId, ProjectInternal)>();
        for (entry in projects.entries()) {
          projectEntries.add(entry);
        };
        projectEntries.toArray().filter(
          func(tuple) {
            tuple.1.project.name.toLower().contains(#text lowerTerm);
          }
        ).map<(ProjectId, ProjectInternal), ProjectInternal>(func(tuple) { tuple.1 }).map<ProjectInternal, Project>(func(internal) { internal.project });
      };
    };
  };

  //-------------------------------------------------
  // Project Management
  //-------------------------------------------------
  /// Add or update a project for the caller
  public shared ({ caller }) func saveProject(project : Project) : async ProjectId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create projects");
    };
    // Validate coordinates
    if (project.coordinates.size() < 3) {
      Runtime.trap("At least 3 coordinates required.");
    };

    // Validate area and perimeter
    let id = nextProjectId;
    let updatedProject = project;
    let projectInternal : ProjectInternal = {
      project = updatedProject;
      creationTime = Time.now();
    };

    let userProjectsMap = switch (userProjects.get(caller)) {
      case (null) { Map.empty<ProjectId, ProjectInternal>() };
      case (?projects) { projects };
    };
    userProjectsMap.add(id, projectInternal);
    userProjects.add(caller, userProjectsMap);

    nextProjectId += 1;
    id;
  };

  /// Remove a project for the caller
  public shared ({ caller }) func removeProject(projectId : ProjectId) : async ProjectId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete projects");
    };
    switch (userProjects.get(caller)) {
      case (null) { Runtime.trap("Project not found.") };
      case (?projects) {
        if (not projects.containsKey(projectId)) { Runtime.trap("Project not found.") };
        projects.remove(projectId);
        projectId;
      };
    };
  };

  //-------------------------------------------------
  // Helper Functions
  //-------------------------------------------------
  /// Calculate the area using the Shoelace formula
  func calculateArea(coordinates : [(Float, Float)]) : Meters {
    let n = coordinates.size();

    if (n < 3) { return 0 };

    var area : Float = 0;

    let rangeIter = Nat32.range(0, n.toNat32());
    for (i in rangeIter) {
      let (x1, y1) = coordinates[i.toNat()];
      let (x2, y2) = coordinates[((i.toNat() + 1) % n).toNat32().toNat()];
      area += (x1 * y2) - (x2 * y1);
    };
    area * 0.5;
  };
};
