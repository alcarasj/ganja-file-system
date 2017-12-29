# API
* All routes have been tested using Postman (https://www.getpostman.com/).
* All routes accept HTTP requests with a JSON body. Required fields are marked with a `*`.
* All routes will return a JSON response body containing `success`:`bool` and `message`:`string` (along with the rest of the data) to indicate whether or not the operation was performed successfully. The `message` will also help the user to identify errors. 
* All routes except `/login` and `/register` will require a `token` string to be passed in the `x-access-token` request header for authorization.
* `FILE_NAME` is the URI-encoded string of a file's name.

|Route|Type|Description|Request Body|Response Body|
|----|---|----|----|----|
| `/login` |POST (urlencoded)|User login. Returns a token for use on all routes.|`email*`:`string`, `password*`:`string`|`token`:`string`|
| `/register` |POST (urlencoded)|User registration.|`email*`:`string`, `password*`:`string`|-|
| `/upload` |POST (form-data)|Uploads one file to the system, with option to overwrite if file already exists, and option to make file lockable or not.|`file*`:`File`, `overwrite`:`bool`, `lockable`:`bool`|-|
| `/files` |GET|Lists all files that are currently in the system.|-|-|
| `/files/FILE_NAME` |GET|Downloads a file from the system specified by `FILE_NAME`.|-|-|
| `/files/FILE_NAME` |DELETE|Deletes a file from the system specified by `FILE_NAME`.|-|-|
| `/lock` |GET|Locks a lockable file in the system for the user, with option for lock time in seconds (default is 60, max is 86400).|`fileName*`:`string`, `lockTime`:`int`|-|
| `/unlock` |GET|Unlocks a file that was locked by the same user.|`fileName*`:`string`|-|
| `/checkForLock` |GET|Checks if a file is currently locked. The `modify` response field indicates whether the file can be modified by the user (this is used on several routes).|`fileName*`:`string`|`locked`:`boolean`, `modify`:`boolean`|