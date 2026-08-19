export namespace main {
	
	export class AppSettings {
	    appScale: number;
	    showHidden: boolean;
	    showExtensions: boolean;
	    foldersFirst: boolean;
	    isDarkTheme: boolean;
	    defaultPath: string;
	    confirmDelete: boolean;
	    customTerminal: string;
	    cacheCleanupDays: number;
	    projectsPath: string;
	    language: string;
	    customCleanPaths: string[];
	    disabledModules: string[];
	    shortcuts: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new AppSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appScale = source["appScale"];
	        this.showHidden = source["showHidden"];
	        this.showExtensions = source["showExtensions"];
	        this.foldersFirst = source["foldersFirst"];
	        this.isDarkTheme = source["isDarkTheme"];
	        this.defaultPath = source["defaultPath"];
	        this.confirmDelete = source["confirmDelete"];
	        this.customTerminal = source["customTerminal"];
	        this.cacheCleanupDays = source["cacheCleanupDays"];
	        this.projectsPath = source["projectsPath"];
	        this.language = source["language"];
	        this.customCleanPaths = source["customCleanPaths"];
	        this.disabledModules = source["disabledModules"];
	        this.shortcuts = source["shortcuts"];
	    }
	}
	export class CustomModule {
	    id: string;
	    name: string;
	    html: string;
	    js: string;
	
	    static createFrom(source: any = {}) {
	        return new CustomModule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.html = source["html"];
	        this.js = source["js"];
	    }
	}
	export class FileInfo {
	    name: string;
	    isDir: boolean;
	    path: string;
	    id: string;
	
	    static createFrom(source: any = {}) {
	        return new FileInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.isDir = source["isDir"];
	        this.path = source["path"];
	        this.id = source["id"];
	    }
	}
	export class GitCommit {
	    hash: string;
	    message: string;
	    date: string;
	
	    static createFrom(source: any = {}) {
	        return new GitCommit(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hash = source["hash"];
	        this.message = source["message"];
	        this.date = source["date"];
	    }
	}
	export class GitRepo {
	    name: string;
	    path: string;
	    branch: string;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new GitRepo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.branch = source["branch"];
	        this.status = source["status"];
	    }
	}
	export class RangerState {
	    currentPath: string;
	    parentPath: string;
	    files: FileInfo[];
	
	    static createFrom(source: any = {}) {
	        return new RangerState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentPath = source["currentPath"];
	        this.parentPath = source["parentPath"];
	        this.files = this.convertValues(source["files"], FileInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RemoteRepo {
	    name: string;
	    fullName: string;
	    description: string;
	    cloneUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new RemoteRepo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.fullName = source["fullName"];
	        this.description = source["description"];
	        this.cloneUrl = source["cloneUrl"];
	    }
	}

}

