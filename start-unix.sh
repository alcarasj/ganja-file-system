#!/bin/bash

$FILE_SERVER ./ganja-file-server/start-file-server-unix.sh
$CLUSTER_SERVER ./ganja-cluster-server/start-cluster-server-unix.sh
$AUTH_SERVER ./ganja-auth-server/start-auth-server-unix.sh
$LOCK_SERVER ./ganja-lock-server/start-lock-server-unix.sh
$WEB_SERVER ./ganja-web-server/start-web-server-unix.sh

chmod u+x **/*.sh
source \"${FILE_SERVER}\" &
source \"$CLUSTER_SERVER\" &
source \"$AUTH_SERVER\" &
source \"$LOCK_SERVER\" &
source \"$WEB_SERVER\" &
wait
	

